import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ServerUserRole } from '../../shared/permissions';

const execAsync = promisify(exec);

export interface LarkUserInfo {
  openId: string;
  userName: string;
  tenantKey: string;
}

export interface LarkUserMapping {
  userId: string;
  role: ServerUserRole;
  email: string;
  name: string;
}

export interface LarkConfig {
  mappings: Record<string, LarkUserMapping>;
}

/**
 * Executes a lark-cli subcommand, checking common binary path locations.
 */
export async function runLarkCommand(subcommand: string): Promise<string> {
  const possiblePaths = [
    'lark-cli',
    '/Users/zz-orka/.nvm/versions/node/v20.20.0/bin/lark-cli',
    '/usr/local/bin/lark-cli',
    '/opt/homebrew/bin/lark-cli'
  ];

  for (const cmdPath of possiblePaths) {
    try {
      const { stdout } = await execAsync(`${cmdPath} ${subcommand}`);
      return stdout;
    } catch (err: any) {
      // If it's a CLI command-not-found error, try the next path.
      const isNotFound = err.code === 127 || 
                         err.message?.includes('not found') || 
                         err.message?.includes('ENOENT') ||
                         err.message?.includes('cannot find');
      if (isNotFound) {
        continue;
      }
      // If command executed but returned a non-zero exit code (e.g. connection error), throw it.
      throw err;
    }
  }
  throw new Error('lark-cli binary not found in PATH or standard locations');
}

/**
 * Checks the status of the local lark-cli and returns the logged-in user info if valid.
 */
export async function checkLarkCliAuth(): Promise<LarkUserInfo | null> {
  if (process.env.NODE_ENV === 'test') {
    return null;
  }
  try {
    const stdout = await runLarkCommand('contact +get-user');
    const response = JSON.parse(stdout);
    if (response.ok && response.identity === 'user' && response.data?.user) {
      const u = response.data.user;
      return {
        openId: u.open_id,
        userName: u.name,
        tenantKey: u.tenant_key,
      };
    }
  } catch (error) {
    console.warn('[LARK AUTH] Failed to retrieve lark-cli user status:', error);
  }
  return null;
}

/**
 * Loads the local Lark OpenID-to-role mappings from .zbom.lark.json config.
 */
export async function loadLarkMappings(): Promise<LarkConfig | null> {
  const configPath = path.join(process.cwd(), '.zbom.lark.json');
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}
