import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { connectSSH, findLogFiles, readLogFiles, parseLogEntries } from '../utils';

export const actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    
    try {
      // Use shared SSH connection utility
      const ssh = await connectSSH(data);
      
      try {
        // Find access log files
        const accessLogFiles = await findLogFiles(ssh, "access.log*");
        
        // Read log content from found files
        const { logContent, logFiles } = await readLogFiles(ssh, accessLogFiles);
        
        // Parse logs
        const entries = parseLogEntries(logContent);

        return {
          success: true,
          // Stringify entries to avoid serialization issues with Date objects
          entries: JSON.stringify(entries),
          logFiles
        };
      } catch (error) {
        ssh.dispose();
        console.error('Error processing logs:', error);
        return fail(500, {
          success: false,
          error: error.message || 'Failed to process log files'
        });
      }
    } catch (error) {
      console.error('SSH connection error:', error);
      return fail(400, {
        success: false,
        error: error.message || 'SSH connection failed'
      });
    }
  }
};
