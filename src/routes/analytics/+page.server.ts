import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { NodeSSH } from 'node-ssh';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';


export const actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    
    // Use form data or fallback to dev credentials in development mode
    const host = dev ? env.SSH_HOST : data.get('host')?.toString();
    const port = dev ? env.SSH_PORT : Number(data.get('port')) || 22;
    const username = dev ? env.SSH_USERNAME : data.get('username')?.toString();
    const password = dev ? env.SSH_PWD : data.get('password')?.toString();
    const privateKey = dev ? env.SSH_PRIVATE_KEY : data.get('privateKey')?.toString();

    console.log(host, port, username, password, privateKey);
    
    if (!host || !username || (!password && !privateKey)) {
      return fail(400, { 
        error: 'Missing required SSH credentials',
        success: false
      });
    }

    try {
      const ssh = new NodeSSH();
      
      // Connect using either password or private key
      await ssh.connect({
        host,
        port,
        username,
        password: password || undefined,
        privateKey: privateKey || undefined,
      });

      console.log('SSH connection established');
      
      // Check current working directory and list files in ~/logs
      const pwdResult = await ssh.execCommand('pwd');
      console.log('Current directory:', pwdResult.stdout);
      
      const lsResult = await ssh.execCommand('ls -la ~/logs');
      console.log('Files in ~/logs:', lsResult.stdout || lsResult.stderr);
      
      // Find all error log files (both regular and compressed)
      // Use -L flag to follow symbolic links
      const findErrorLogsResult = await ssh.execCommand('find -L ~/logs -name "error.log*" | sort');
      let errorLogFiles = findErrorLogsResult.stdout.split('\n').filter(file => file.trim());
      
      // If no files found via symlink, try direct path to sitelogs as a fallback
      if (errorLogFiles.length === 0) {
        console.log('No logs found in ~/logs, trying /var/log/sitelogs directory directly');
        const directPathResult = await ssh.execCommand('find -L /var/log/sitelogs -name "error.log*" | sort');
        errorLogFiles = directPathResult.stdout.split('\n').filter(file => file.trim());
      }
      
      console.log('Found error logs:', errorLogFiles);
      
      // If no error logs found
      if (errorLogFiles.length === 0) {
        ssh.dispose();
        return {
          success: true,
          logContent: '',
          logFiles: []
        };
      }
      
      // Process each file based on type (.gz or regular)
      let combinedLogs = '';
      const processedFiles = [];
      
      for (const filePath of errorLogFiles) {
        let fileContent = '';
        let command = '';
        
        if (filePath.endsWith('.gz')) {
          // For compressed files, use zcat (gunzip -c) to view without decompressing
          command = `zcat ${filePath}`;
          const fileName = filePath.split('/').pop();
          processedFiles.push({ name: fileName, compressed: true });
        } else {
          // For regular files, just cat them
          command = `cat ${filePath}`;
          const fileName = filePath.split('/').pop();
          processedFiles.push({ name: fileName, compressed: false });
        }
        
        const result = await ssh.execCommand(command);
        
        if (!result.stderr) {
          fileContent = result.stdout;
          // Add a header for each file to identify its source
          const fileHeader = `\n--- From ${filePath} ---\n`;
          combinedLogs += fileHeader + fileContent + '\n';
        } else {
          console.error(`Error reading ${filePath}:`, result.stderr);
        }
      }
      
      // Disconnect from the server
      ssh.dispose();
      
      return {
        success: true,
        logContent: combinedLogs,
        logFiles: processedFiles
      };
    } catch (error: unknown) {
      console.error('SSH connection error:', error);
      let message = 'Failed to connect';
      if (error instanceof Error) message = `Failed to connect: ${error.message}`;
      return fail(500, {
        error: message,
        success: false
      });
    }
  }
} satisfies Actions;