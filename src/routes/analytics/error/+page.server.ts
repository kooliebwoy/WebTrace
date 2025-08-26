import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { connectSSH, findLogFiles, readLogFiles } from '../utils';

export const actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    
    try {
      // Use shared SSH connection utility
      const ssh = await connectSSH(data);
      
      try {
        // Find error log files
        const errorLogFiles = await findLogFiles(ssh, "error.log*");
        
        // Read log content from found files
        const { logContent, logFiles } = await readLogFiles(ssh, errorLogFiles);
        
        // Disconnect from the server
        ssh.dispose();
        
        return {
          success: true,
          logContent,
          logFiles
        };
      } catch (error: unknown) {
        ssh.dispose();
        console.error('Error processing logs:', error);
        return fail(500, {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to process log files'
        });
      }
    } catch (error: unknown) {
      console.error('SSH connection error:', error);
      return fail(400, {
        success: false,
        error: error instanceof Error ? error.message : 'SSH connection failed'
      });
    }
  }
};
