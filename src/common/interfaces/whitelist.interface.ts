export interface WhitelistEntry {
  ip: string;
  description?: string;
  department?: string;
  employeeId?: string;
}

export interface WhitelistConfig {
  version: string;
  lastUpdated: string;
  environment: string;
  options: {
    enableLogging: boolean;
    enableExpiration: boolean;
    defaultAction: 'allow' | 'deny';
  };
  allowedIps: WhitelistEntry[];
}

export interface WhitelistMetadata {
  ip: string;
  department?: string;
  employeeId?: string;
  description?: string;
}
