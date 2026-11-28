import {
  AdminEgg,
  AdminLocation,
  AdminNest,
  AdminNode,
  AdminUser,
  AppDatabase,
  AppServer,
  CreateAllocationInput,
  CreateAppDatabaseInput,
  CreateLocationInput,
  CreateNodeInput,
  CreateServerInput,
  CreateUserInput,
  ListOptions,
  NodeAllocation,
  NodeConfiguration,
  NodeHealthStatus,
  PaginatedResult,
  ParsedAPIError,
  PermissionProbeStatus,
  UpdateServerBuildInput,
  UpdateServerDetailsInput,
  UpdateServerStartupInput,
  UpdateUserInput,
} from '../types/admin';

export function getAppBindings(): any {
  // @ts-ignore
  const app = window.go?.main?.App;
  if (!app) {
    throw new Error('Wails backend bindings are not available.');
  }
  return app;
}

export async function adminListUsers(opts: ListOptions): Promise<PaginatedResult<AdminUser>> {
  const app = getAppBindings();
  return app.AdminListUsers(opts);
}

export async function adminGetUser(id: number): Promise<AdminUser> {
  const app = getAppBindings();
  return app.AdminGetUser(id);
}

export async function adminCreateUser(req: CreateUserInput): Promise<AdminUser> {
  const app = getAppBindings();
  return app.AdminCreateUser(req);
}

export async function adminUpdateUser(id: number, req: UpdateUserInput): Promise<AdminUser> {
  const app = getAppBindings();
  return app.AdminUpdateUser(id, req);
}

export async function adminDeleteUser(id: number): Promise<void> {
  const app = getAppBindings();
  return app.AdminDeleteUser(id);
}

// --- Servers ---

export async function adminListServers(opts: ListOptions): Promise<PaginatedResult<AppServer>> {
  const app = getAppBindings();
  return app.AdminListServers(opts);
}

export async function adminGetServer(id: number): Promise<AppServer> {
  const app = getAppBindings();
  return app.AdminGetServer(id);
}

export async function adminCreateServer(req: CreateServerInput): Promise<AppServer> {
  const app = getAppBindings();
  return app.AdminCreateServer(req);
}

export async function adminUpdateServerDetails(id: number, req: UpdateServerDetailsInput): Promise<AppServer> {
  const app = getAppBindings();
  return app.AdminUpdateServerDetails(id, req);
}

export async function adminUpdateServerBuild(id: number, req: UpdateServerBuildInput): Promise<AppServer> {
  const app = getAppBindings();
  return app.AdminUpdateServerBuild(id, req);
}

export async function adminUpdateServerStartup(id: number, req: UpdateServerStartupInput): Promise<AppServer> {
  const app = getAppBindings();
  return app.AdminUpdateServerStartup(id, req);
}

export async function adminSuspendServer(id: number): Promise<void> {
  const app = getAppBindings();
  return app.AdminSuspendServer(id);
}

export async function adminUnsuspendServer(id: number): Promise<void> {
  const app = getAppBindings();
  return app.AdminUnsuspendServer(id);
}

export async function adminReinstallServer(id: number): Promise<void> {
  const app = getAppBindings();
  return app.AdminReinstallServer(id);
}

export async function adminDeleteServer(id: number, force = false): Promise<void> {
  const app = getAppBindings();
  return app.AdminDeleteServer(id, force);
}

// --- Nodes ---

export async function adminListNodes(opts: ListOptions): Promise<PaginatedResult<AdminNode>> {
  const app = getAppBindings();
  return app.AdminListNodes(opts);
}

export async function adminGetNode(id: number): Promise<AdminNode> {
  const app = getAppBindings();
  return app.GetNode(id);
}

export async function adminGetNodeConfiguration(id: number): Promise<NodeConfiguration> {
  const app = getAppBindings();
  return app.AdminGetNodeConfiguration(id);
}

export async function adminCreateNode(req: CreateNodeInput): Promise<AdminNode> {
  const app = getAppBindings();
  return app.CreateNode(req);
}

export async function adminUpdateNode(id: number, req: CreateNodeInput): Promise<AdminNode> {
  const app = getAppBindings();
  return app.AdminUpdateNode(id, req);
}

export async function adminDeleteNode(id: number): Promise<void> {
  const app = getAppBindings();
  return app.DeleteNode(id);
}

// --- Locations ---

export async function adminListLocations(opts: ListOptions): Promise<PaginatedResult<AdminLocation>> {
  const app = getAppBindings();
  return app.AdminListLocations(opts);
}

export async function adminGetLocation(id: number): Promise<AdminLocation> {
  const app = getAppBindings();
  return app.AdminGetLocation(id);
}

export async function adminCreateLocation(req: CreateLocationInput): Promise<AdminLocation> {
  const app = getAppBindings();
  return app.AdminCreateLocation(req);
}

export async function adminUpdateLocation(id: number, req: CreateLocationInput): Promise<AdminLocation> {
  const app = getAppBindings();
  return app.AdminUpdateLocation(id, req);
}

export async function adminDeleteLocation(id: number): Promise<void> {
  const app = getAppBindings();
  return app.AdminDeleteLocation(id);
}

// --- Nests & Eggs ---

export async function adminListNests(opts: ListOptions): Promise<PaginatedResult<AdminNest>> {
  const app = getAppBindings();
  return app.AdminListNests(opts);
}

export async function adminListEggs(nestId: number, opts: ListOptions): Promise<PaginatedResult<AdminEgg>> {
  const app = getAppBindings();
  return app.AdminListEggs(nestId, opts);
}

export async function adminGetEgg(nestId: number, eggId: number): Promise<AdminEgg> {
  const app = getAppBindings();
  return app.AdminGetEgg(nestId, eggId);
}

// --- Allocations ---

export async function adminListNodeAllocations(
  nodeId: number,
  opts: ListOptions
): Promise<PaginatedResult<NodeAllocation>> {
  const app = getAppBindings();
  return app.AdminListNodeAllocations(nodeId, opts);
}

export async function adminCreateNodeAllocations(nodeId: number, req: CreateAllocationInput): Promise<void> {
  const app = getAppBindings();
  return app.AdminCreateNodeAllocations(nodeId, req);
}

export async function adminDeleteNodeAllocation(nodeId: number, allocationId: number): Promise<void> {
  const app = getAppBindings();
  return app.AdminDeleteNodeAllocation(nodeId, allocationId);
}

// --- Databases ---

export async function adminListServerDatabases(
  serverId: number,
  opts: ListOptions
): Promise<PaginatedResult<AppDatabase>> {
  const app = getAppBindings();
  return app.AdminListServerDatabases(serverId, opts);
}

export async function adminGetServerDatabase(
  serverId: number,
  databaseId: number,
  includePassword = false
): Promise<AppDatabase> {
  const app = getAppBindings();
  return app.AdminGetServerDatabase(serverId, databaseId, includePassword);
}

export async function adminCreateServerDatabase(
  serverId: number,
  req: CreateAppDatabaseInput
): Promise<AppDatabase> {
  const app = getAppBindings();
  return app.AdminCreateServerDatabase(serverId, req);
}

export async function adminResetServerDatabasePassword(serverId: number, databaseId: number): Promise<void> {
  const app = getAppBindings();
  return app.AdminResetServerDatabasePassword(serverId, databaseId);
}

export async function adminDeleteServerDatabase(serverId: number, databaseId: number): Promise<void> {
  const app = getAppBindings();
  return app.AdminDeleteServerDatabase(serverId, databaseId);
}

export async function adminProbePermissions(): Promise<Record<string, PermissionProbeStatus>> {
  const app = getAppBindings();
  return app.AdminProbePermissions();
}

export async function adminCheckNodeHealth(nodeId: number): Promise<NodeHealthStatus> {
  const app = getAppBindings();
  return app.AdminCheckNodeHealth(nodeId);
}

export async function adminCheckNodesHealth(): Promise<Record<number, NodeHealthStatus>> {
  const app = getAppBindings();
  return app.AdminCheckNodesHealth();
}

export function parseBackendError(err: unknown): ParsedAPIError {
  const raw = typeof err === 'string' ? err : (err as any)?.message || String(err || 'Unknown error');

  // Match pattern: API error 403 (HttpForbiddenException) [req:abc]: detail
  const match = raw.match(/API error (\d+)\s*\(([^)]+)\)(?:\s*\[req:([^\]]+)\])?:\s*(.+)/);
  if (match) {
    const statusCode = parseInt(match[1], 10);
    const code = match[2];
    const requestId = match[3] || undefined;
    const message = match[4].trim();

    let permissionHint: string | undefined;
    if (statusCode === 403) {
      permissionHint =
        'Your Application API key does not have permission for this operation. Check the key scopes (Read / Read & Write) in Pterodactyl Admin -> Application API.';
    } else if (statusCode === 401) {
      permissionHint =
        'Authentication failed. Verify that your Application API key is valid and has not been revoked.';
    }

    return {
      statusCode,
      code,
      requestId,
      message,
      permissionHint,
      raw,
    };
  }

  return {
    message: raw,
    raw,
  };
}
