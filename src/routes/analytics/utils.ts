import { NodeSSH } from 'node-ssh';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';

// Shared SSH connection utility
export async function connectSSH(formData?: FormData) {
  // Use form data or fallback to dev credentials in development mode
  const host = dev ? env.SSH_HOST : formData?.get('host')?.toString();
  const port = dev ? env.SSH_PORT : Number(formData?.get('port')) || 22;
  const username = dev ? env.SSH_USERNAME : formData?.get('username')?.toString();
  const password = dev ? env.SSH_PWD : formData?.get('password')?.toString();
  const privateKey = dev ? env.SSH_PRIVATE_KEY : formData?.get('privateKey')?.toString();
  
  if (!host || !username || (!password && !privateKey)) {
    throw new Error('Missing required SSH credentials');
  }
  
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
  console.log(`${host} ${port} ${username} ${password?.substring(0, 5)} ${privateKey ? 'key provided' : 'no key'}`);
  
  return ssh;
}

// Utility to find log files of a specific type
export async function findLogFiles(ssh: NodeSSH, filePattern: string) {
  // Check current working directory and list files in ~/logs
  const pwdResult = await ssh.execCommand('pwd');
  console.log('Current directory:', pwdResult.stdout);
  
  const lsResult = await ssh.execCommand('ls -la ~/logs');
  console.log('Files in ~/logs:', lsResult.stdout || lsResult.stderr);
  
  // Find all log files (both regular and compressed)
  // Use -L flag to follow symbolic links
  const findLogsResult = await ssh.execCommand(`find -L ~/logs -name "${filePattern}" | sort`);
  let logFiles = findLogsResult.stdout.split('\n').filter(file => file.trim());
  
  // If no files found via symlink, try direct path to sitelogs as a fallback
  if (logFiles.length === 0) {
    console.log(`No ${filePattern} logs found in ~/logs, trying /var/log/sitelogs directory directly`);
    const directPathResult = await ssh.execCommand(`find -L /var/log/sitelogs -name "${filePattern}" | sort`);
    logFiles = directPathResult.stdout.split('\n').filter(file => file.trim());
  }
  
  console.log(`Found ${filePattern} logs:`, logFiles);
  
  return logFiles;
}

// Utility to read log files (handles both regular and compressed files)
export async function readLogFiles(ssh: NodeSSH, logFiles: string[]) {
  // If no logs found
  if (logFiles.length === 0) {
    return {
      logContent: '',
      logFiles: []
    };
  }
  
  // Process each file based on type (.gz or regular)
  let combinedLogs = '';
  const processedFiles = [];
  
  for (const filePath of logFiles) {
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
  
  return {
    logContent: combinedLogs,
    logFiles: processedFiles
  };
}
