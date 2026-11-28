export interface PaginationMeta {
  total: number;
  count: number;
  per_page: number;
  current_page: number;
  total_pages: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface ListOptions {
  page?: number;
  perPage?: number;
  filters?: Record<string, string>;
  sort?: string;
  include?: string[];
}

export interface ParsedAPIError {
  statusCode?: number;
  code?: string;
  requestId?: string;
  message: string;
  permissionHint?: string;
  raw: string;
}

export interface AdminUser {
  id: number;
  external_id?: string | null;
  uuid: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  language: string;
  root_admin: boolean;
  '2fa': boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateUserInput {
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  password?: string;
  language?: string;
  root_admin?: boolean;
  external_id?: string | null;
}

export interface UpdateUserInput {
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  password?: string;
  language?: string;
  root_admin?: boolean;
  external_id?: string | null;
}

export interface ServerLimits {
  memory: number;
  swap: number;
  disk: number;
  io: number;
  cpu: number;
  threads?: string | null;
  oom_disabled?: boolean;
}

export interface FeatureLimits {
  databases: number;
  allocations: number;
  backups: number;
}

export interface ServerContainer {
  startup_command: string;
  image: string;
  installed: number;
  environment: Record<string, unknown>;
}

export interface AppServer {
  id: number;
  external_id?: string | null;
  uuid: string;
  identifier: string;
  name: string;
  description: string;
  status?: string | null;
  suspended: boolean;
  limits: ServerLimits;
  feature_limits: FeatureLimits;
  user: number;
  node: number;
  allocation: number;
  nest: number;
  egg: number;
  container: ServerContainer;
  created_at: string;
  updated_at: string;
}

export interface CreateServerInput {
  external_id?: string | null;
  name: string;
  description?: string;
  user: number;
  egg: number;
  docker_image: string;
  startup: string;
  environment: Record<string, unknown>;
  limits: ServerLimits;
  feature_limits: FeatureLimits;
  allocation: {
    default: number;
    additional?: number[];
  };
  oom_disabled?: boolean;
  start_on_completion?: boolean;
  skip_scripts?: boolean;
}

export interface UpdateServerDetailsInput {
  name: string;
  user: number;
  external_id?: string | null;
  description: string;
}

export interface UpdateServerBuildInput {
  allocation: number;
  oom_disabled: boolean;
  memory: number;
  swap: number;
  disk: number;
  io: number;
  cpu: number;
  threads?: string | null;
  feature_limits: FeatureLimits;
  add_allocations?: number[];
  remove_allocations?: number[];
}

export interface UpdateServerStartupInput {
  startup: string;
  environment: Record<string, unknown>;
  egg: number;
  image: string;
  skip_scripts: boolean;
}

export interface AdminNode {
  id: number;
  uuid: string;
  public: boolean;
  name: string;
  description: string;
  location_id: number;
  fqdn: string;
  scheme: string;
  behind_proxy: boolean;
  maintenance_mode: boolean;
  memory: number;
  memory_overallocate: number;
  disk: number;
  disk_overallocate: number;
  upload_size: number;
  daemon_listen: number;
  daemon_sftp: number;
  daemon_base: string;
  created_at: string;
  updated_at: string;
  allocated_resources?: {
    memory: number;
    disk: number;
  };
}

export interface CreateNodeInput {
  name: string;
  description?: string;
  location_id: number;
  fqdn: string;
  scheme: 'http' | 'https';
  public: boolean;
  memory: number;
  memory_overallocate: number;
  disk: number;
  disk_overallocate: number;
  upload_size: number;
  daemon_sftp: number;
  daemon_listen: number;
  daemon_base?: string;
  behind_proxy: boolean;
  maintenance_mode: boolean;
}

export interface NodeConfiguration {
  debug: boolean;
  uuid: string;
  token_id: string;
  token: string;
  api: {
    host: string;
    port: number;
    upload_limit: number;
    ssl: {
      enabled: boolean;
      cert: string;
      key: string;
    };
  };
  system: {
    data: string;
    sftp: {
      bind_port: number;
    };
  };
  allowed_mounts: string[];
  remote: string;
}

export interface AdminLocation {
  id: number;
  short: string;
  long: string;
  created_at: string;
  updated_at: string;
}

export interface CreateLocationInput {
  short: string;
  long: string;
}

export interface AdminNest {
  id: number;
  uuid: string;
  author: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface EggVariable {
  name: string;
  description: string;
  env_variable: string;
  default_value: string;
  server_value: string;
  is_editable: boolean;
  rules: string;
}

export interface AdminEgg {
  id: number;
  uuid: string;
  name: string;
  nest: number;
  author: string;
  description: string;
  docker_image: string;
  docker_images?: Record<string, string>;
  startup: string;
  config?: {
    files?: unknown;
    startup?: unknown;
    stop?: string;
    logs?: unknown;
  };
  script?: {
    privileged: boolean;
    install: string;
    entry: string;
    container: string;
    extends?: string | null;
  };
  relationships?: {
    variables?: {
      data: Array<{ attributes: EggVariable }>;
    };
  };
  created_at: string;
  updated_at: string;
}

export interface NodeAllocation {
  id: number;
  ip: string;
  alias?: string | null;
  port: number;
  notes?: string | null;
  assigned: boolean;
}

export interface CreateAllocationInput {
  ip: string;
  alias?: string;
  ports: string[];
}

export interface AppDatabase {
  id: number;
  server: number;
  host: number;
  database: string;
  username: string;
  remote: string;
  max_connections: number;
  created_at: string;
  updated_at: string;
  relationships?: {
    password?: {
      attributes: {
        password: string;
      };
    };
    host?: {
      attributes: {
        id: number;
        name: string;
        host: string;
        port: number;
        username: string;
        node: number;
      };
    };
  };
}

export interface CreateAppDatabaseInput {
  database: string;
  remote: string;
  host: number;
  max_connections?: number;
}

export interface PermissionProbeStatus {
  allowed: boolean;
  statusCode: number;
  error?: string;
  attempts: number;
}

export interface NodeHealthStatus {
  nodeId: number;
  reachable: boolean;
  latencyMs: number;
  statusCode?: number;
  error?: string;
  checkedAt: string;
}
