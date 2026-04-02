import { log } from '../utils/logger.js';
import { withSpinner } from '../utils/spinner.js';
import { ServerInstaller } from '../core/server-installer.js';

export async function cleanupCommand(): Promise<void> {
  log.header('KW-OS Cleanup');
  log.dim('Remove obsolete server installations and clean up old files\n');

  const installer = new ServerInstaller();

  await withSpinner(
    'Cleaning up old server installations',
    () => installer.cleanupOldServers()
  );

  log.success('Cleanup completed successfully!');
  log.info('Run "kw-os status" to verify your installation health.');
}
