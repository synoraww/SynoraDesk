export namespace api {
	
	export class Account {
	    id: number;
	    admin: boolean;
	    username: string;
	    email: string;
	    first_name: string;
	    last_name: string;
	    language: string;
	    "2fa"?: boolean;
	    "2fa_enabled"?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Account(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.admin = source["admin"];
	        this.username = source["username"];
	        this.email = source["email"];
	        this.first_name = source["first_name"];
	        this.last_name = source["last_name"];
	        this.language = source["language"];
	        this["2fa"] = source["2fa"];
	        this["2fa_enabled"] = source["2fa_enabled"];
	    }
	}
	export class AccountActivity {
	    id: string;
	    batch: string;
	    event: string;
	    is_api: boolean;
	    ip: string;
	    description?: string;
	    properties: Record<string, any>;
	    has_additional_metadata: boolean;
	    // Go type: time
	    timestamp: any;
	
	    static createFrom(source: any = {}) {
	        return new AccountActivity(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.batch = source["batch"];
	        this.event = source["event"];
	        this.is_api = source["is_api"];
	        this.ip = source["ip"];
	        this.description = source["description"];
	        this.properties = source["properties"];
	        this.has_additional_metadata = source["has_additional_metadata"];
	        this.timestamp = this.convertValues(source["timestamp"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class AccountApiKey {
	    identifier: string;
	    description: string;
	    allowed_ips: string[];
	    // Go type: time
	    last_used_at?: any;
	    // Go type: time
	    created_at: any;
	    secret_token?: string;
	
	    static createFrom(source: any = {}) {
	        return new AccountApiKey(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.identifier = source["identifier"];
	        this.description = source["description"];
	        this.allowed_ips = source["allowed_ips"];
	        this.last_used_at = this.convertValues(source["last_used_at"], null);
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.secret_token = source["secret_token"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class AccountSSHKey {
	    name: string;
	    fingerprint: string;
	    public_key: string;
	    // Go type: time
	    created_at: any;
	
	    static createFrom(source: any = {}) {
	        return new AccountSSHKey(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.fingerprint = source["fingerprint"];
	        this.public_key = source["public_key"];
	        this.created_at = this.convertValues(source["created_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Allocation {
	    id: number;
	    ip: string;
	    ip_alias?: string;
	    port: number;
	    notes?: string;
	    is_default: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Allocation(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.ip = source["ip"];
	        this.ip_alias = source["ip_alias"];
	        this.port = source["port"];
	        this.notes = source["notes"];
	        this.is_default = source["is_default"];
	    }
	}
	export class AllocationData {
	    attributes: Allocation;
	
	    static createFrom(source: any = {}) {
	        return new AllocationData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.attributes = this.convertValues(source["attributes"], Allocation);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class AllocationsRelationship {
	    data: AllocationData[];
	
	    static createFrom(source: any = {}) {
	        return new AllocationsRelationship(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.data = this.convertValues(source["data"], AllocationData);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class AppDatabaseHostAttributes {
	    id: number;
	    name: string;
	    host: string;
	    port: number;
	    username: string;
	    node: number;
	
	    static createFrom(source: any = {}) {
	        return new AppDatabaseHostAttributes(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.username = source["username"];
	        this.node = source["node"];
	    }
	}
	export class AppDatabaseHostRelationship {
	    object: string;
	    attributes: AppDatabaseHostAttributes;
	
	    static createFrom(source: any = {}) {
	        return new AppDatabaseHostRelationship(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.object = source["object"];
	        this.attributes = this.convertValues(source["attributes"], AppDatabaseHostAttributes);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class AppDatabasePasswordAttributes {
	    password: string;
	
	    static createFrom(source: any = {}) {
	        return new AppDatabasePasswordAttributes(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.password = source["password"];
	    }
	}
	export class AppDatabasePasswordRelationship {
	    object: string;
	    attributes: AppDatabasePasswordAttributes;
	
	    static createFrom(source: any = {}) {
	        return new AppDatabasePasswordRelationship(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.object = source["object"];
	        this.attributes = this.convertValues(source["attributes"], AppDatabasePasswordAttributes);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class AppDatabaseRelationships {
	    password?: AppDatabasePasswordRelationship;
	    host?: AppDatabaseHostRelationship;
	
	    static createFrom(source: any = {}) {
	        return new AppDatabaseRelationships(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.password = this.convertValues(source["password"], AppDatabasePasswordRelationship);
	        this.host = this.convertValues(source["host"], AppDatabaseHostRelationship);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class AppDatabase {
	    id: number;
	    server: number;
	    host: number;
	    database: string;
	    username: string;
	    remote: string;
	    max_connections: number;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	    relationships?: AppDatabaseRelationships;
	
	    static createFrom(source: any = {}) {
	        return new AppDatabase(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.server = source["server"];
	        this.host = source["host"];
	        this.database = source["database"];
	        this.username = source["username"];
	        this.remote = source["remote"];
	        this.max_connections = source["max_connections"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	        this.relationships = this.convertValues(source["relationships"], AppDatabaseRelationships);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	
	
	
	export class Container {
	    startup_command: string;
	    image: string;
	    installed: number;
	    environment: Record<string, any>;
	
	    static createFrom(source: any = {}) {
	        return new Container(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.startup_command = source["startup_command"];
	        this.image = source["image"];
	        this.installed = source["installed"];
	        this.environment = source["environment"];
	    }
	}
	export class FeatureLimits {
	    databases: number;
	    allocations: number;
	    backups: number;
	
	    static createFrom(source: any = {}) {
	        return new FeatureLimits(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.databases = source["databases"];
	        this.allocations = source["allocations"];
	        this.backups = source["backups"];
	    }
	}
	export class ServerLimits {
	    memory: number;
	    swap: number;
	    disk: number;
	    io: number;
	    cpu: number;
	    threads?: string;
	    oom_disabled?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ServerLimits(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.memory = source["memory"];
	        this.swap = source["swap"];
	        this.disk = source["disk"];
	        this.io = source["io"];
	        this.cpu = source["cpu"];
	        this.threads = source["threads"];
	        this.oom_disabled = source["oom_disabled"];
	    }
	}
	export class AppServer {
	    id: number;
	    external_id?: string;
	    uuid: string;
	    identifier: string;
	    name: string;
	    description: string;
	    status?: string;
	    suspended: boolean;
	    limits: ServerLimits;
	    feature_limits: FeatureLimits;
	    user: number;
	    node: number;
	    allocation: number;
	    nest: number;
	    egg: number;
	    container: Container;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	
	    static createFrom(source: any = {}) {
	        return new AppServer(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.external_id = source["external_id"];
	        this.uuid = source["uuid"];
	        this.identifier = source["identifier"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.status = source["status"];
	        this.suspended = source["suspended"];
	        this.limits = this.convertValues(source["limits"], ServerLimits);
	        this.feature_limits = this.convertValues(source["feature_limits"], FeatureLimits);
	        this.user = source["user"];
	        this.node = source["node"];
	        this.allocation = source["allocation"];
	        this.nest = source["nest"];
	        this.egg = source["egg"];
	        this.container = this.convertValues(source["container"], Container);
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Backup {
	    uuid: string;
	    name: string;
	    ignored_files: string[];
	    sha256_hash?: string;
	    bytes: number;
	    is_successful: boolean;
	    is_locked: boolean;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    completed_at?: any;
	
	    static createFrom(source: any = {}) {
	        return new Backup(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.uuid = source["uuid"];
	        this.name = source["name"];
	        this.ignored_files = source["ignored_files"];
	        this.sha256_hash = source["sha256_hash"];
	        this.bytes = source["bytes"];
	        this.is_successful = source["is_successful"];
	        this.is_locked = source["is_locked"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.completed_at = this.convertValues(source["completed_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class CreateAllocationRequest {
	    ip: string;
	    alias?: string;
	    ports: string[];
	
	    static createFrom(source: any = {}) {
	        return new CreateAllocationRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ip = source["ip"];
	        this.alias = source["alias"];
	        this.ports = source["ports"];
	    }
	}
	export class CreateAppDatabaseRequest {
	    database: string;
	    remote: string;
	    host: number;
	    max_connections?: number;
	
	    static createFrom(source: any = {}) {
	        return new CreateAppDatabaseRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.database = source["database"];
	        this.remote = source["remote"];
	        this.host = source["host"];
	        this.max_connections = source["max_connections"];
	    }
	}
	export class CreateLocationRequest {
	    short: string;
	    long: string;
	
	    static createFrom(source: any = {}) {
	        return new CreateLocationRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.short = source["short"];
	        this.long = source["long"];
	    }
	}
	export class CreateNodeRequest {
	    name: string;
	    description?: string;
	    location_id: number;
	    fqdn: string;
	    scheme: string;
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
	
	    static createFrom(source: any = {}) {
	        return new CreateNodeRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.description = source["description"];
	        this.location_id = source["location_id"];
	        this.fqdn = source["fqdn"];
	        this.scheme = source["scheme"];
	        this.public = source["public"];
	        this.memory = source["memory"];
	        this.memory_overallocate = source["memory_overallocate"];
	        this.disk = source["disk"];
	        this.disk_overallocate = source["disk_overallocate"];
	        this.upload_size = source["upload_size"];
	        this.daemon_sftp = source["daemon_sftp"];
	        this.daemon_listen = source["daemon_listen"];
	        this.daemon_base = source["daemon_base"];
	        this.behind_proxy = source["behind_proxy"];
	        this.maintenance_mode = source["maintenance_mode"];
	    }
	}
	export class CreateServerAllocation {
	    default: number;
	    additional?: number[];
	
	    static createFrom(source: any = {}) {
	        return new CreateServerAllocation(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.default = source["default"];
	        this.additional = source["additional"];
	    }
	}
	export class CreateServerRequest {
	    external_id?: string;
	    name: string;
	    description?: string;
	    user: number;
	    egg: number;
	    docker_image: string;
	    startup: string;
	    environment: Record<string, any>;
	    limits: ServerLimits;
	    feature_limits: FeatureLimits;
	    allocation: CreateServerAllocation;
	    oom_disabled?: boolean;
	    start_on_completion?: boolean;
	    skip_scripts?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CreateServerRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.external_id = source["external_id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.user = source["user"];
	        this.egg = source["egg"];
	        this.docker_image = source["docker_image"];
	        this.startup = source["startup"];
	        this.environment = source["environment"];
	        this.limits = this.convertValues(source["limits"], ServerLimits);
	        this.feature_limits = this.convertValues(source["feature_limits"], FeatureLimits);
	        this.allocation = this.convertValues(source["allocation"], CreateServerAllocation);
	        this.oom_disabled = source["oom_disabled"];
	        this.start_on_completion = source["start_on_completion"];
	        this.skip_scripts = source["skip_scripts"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class CreateUserRequest {
	    email: string;
	    username: string;
	    first_name: string;
	    last_name: string;
	    password?: string;
	    language?: string;
	    root_admin: boolean;
	    external_id?: string;
	
	    static createFrom(source: any = {}) {
	        return new CreateUserRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.email = source["email"];
	        this.username = source["username"];
	        this.first_name = source["first_name"];
	        this.last_name = source["last_name"];
	        this.password = source["password"];
	        this.language = source["language"];
	        this.root_admin = source["root_admin"];
	        this.external_id = source["external_id"];
	    }
	}
	export class CronExpression {
	    day_of_week: string;
	    month: string;
	    day_of_month: string;
	    hour: string;
	    minute: string;
	
	    static createFrom(source: any = {}) {
	        return new CronExpression(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.day_of_week = source["day_of_week"];
	        this.month = source["month"];
	        this.day_of_month = source["day_of_month"];
	        this.hour = source["hour"];
	        this.minute = source["minute"];
	    }
	}
	export class Database {
	    id: string;
	    // Go type: struct { Address string "json:\"address\""; Port int "json:\"port\"" }
	    host: any;
	    name: string;
	    username: string;
	    connections_from: string;
	    max_connections: number;
	
	    static createFrom(source: any = {}) {
	        return new Database(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.host = this.convertValues(source["host"], Object);
	        this.name = source["name"];
	        this.username = source["username"];
	        this.connections_from = source["connections_from"];
	        this.max_connections = source["max_connections"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class EggVariable {
	    name: string;
	    description: string;
	    env_variable: string;
	    default_value: string;
	    server_value: string;
	    is_editable: boolean;
	    rules: string;
	
	    static createFrom(source: any = {}) {
	        return new EggVariable(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.description = source["description"];
	        this.env_variable = source["env_variable"];
	        this.default_value = source["default_value"];
	        this.server_value = source["server_value"];
	        this.is_editable = source["is_editable"];
	        this.rules = source["rules"];
	    }
	}
	export class EggVariableData {
	    object: string;
	    attributes: EggVariable;
	
	    static createFrom(source: any = {}) {
	        return new EggVariableData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.object = source["object"];
	        this.attributes = this.convertValues(source["attributes"], EggVariable);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class EggVariablesRelationship {
	    object: string;
	    data: EggVariableData[];
	
	    static createFrom(source: any = {}) {
	        return new EggVariablesRelationship(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.object = source["object"];
	        this.data = this.convertValues(source["data"], EggVariableData);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class EggRelationships {
	    variables?: EggVariablesRelationship;
	
	    static createFrom(source: any = {}) {
	        return new EggRelationships(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.variables = this.convertValues(source["variables"], EggVariablesRelationship);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class EggScript {
	    privileged: boolean;
	    install: string;
	    entry: string;
	    container: string;
	    extends?: string;
	
	    static createFrom(source: any = {}) {
	        return new EggScript(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.privileged = source["privileged"];
	        this.install = source["install"];
	        this.entry = source["entry"];
	        this.container = source["container"];
	        this.extends = source["extends"];
	    }
	}
	export class EggConfig {
	    files: any;
	    startup: any;
	    stop: string;
	    logs: any;
	
	    static createFrom(source: any = {}) {
	        return new EggConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.files = source["files"];
	        this.startup = source["startup"];
	        this.stop = source["stop"];
	        this.logs = source["logs"];
	    }
	}
	export class Egg {
	    id: number;
	    uuid: string;
	    name: string;
	    nest: number;
	    author: string;
	    description: string;
	    docker_image: string;
	    docker_images?: Record<string, string>;
	    startup: string;
	    config?: EggConfig;
	    script?: EggScript;
	    relationships?: EggRelationships;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	
	    static createFrom(source: any = {}) {
	        return new Egg(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.uuid = source["uuid"];
	        this.name = source["name"];
	        this.nest = source["nest"];
	        this.author = source["author"];
	        this.description = source["description"];
	        this.docker_image = source["docker_image"];
	        this.docker_images = source["docker_images"];
	        this.startup = source["startup"];
	        this.config = this.convertValues(source["config"], EggConfig);
	        this.script = this.convertValues(source["script"], EggScript);
	        this.relationships = this.convertValues(source["relationships"], EggRelationships);
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class EggAttributes {
	    uuid: string;
	    name: string;
	
	    static createFrom(source: any = {}) {
	        return new EggAttributes(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.uuid = source["uuid"];
	        this.name = source["name"];
	    }
	}
	
	export class EggRelationship {
	    object: string;
	    attributes: EggAttributes;
	
	    static createFrom(source: any = {}) {
	        return new EggRelationship(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.object = source["object"];
	        this.attributes = this.convertValues(source["attributes"], EggAttributes);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	
	
	
	
	export class FileObject {
	    name: string;
	    mode: string;
	    mode_bits: string;
	    size: number;
	    is_file: boolean;
	    is_symlink: boolean;
	    mimetype: string;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    modified_at?: any;
	
	    static createFrom(source: any = {}) {
	        return new FileObject(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.mode = source["mode"];
	        this.mode_bits = source["mode_bits"];
	        this.size = source["size"];
	        this.is_file = source["is_file"];
	        this.is_symlink = source["is_symlink"];
	        this.mimetype = source["mimetype"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.modified_at = this.convertValues(source["modified_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ListOptions {
	    page?: number;
	    perPage?: number;
	    filters?: Record<string, string>;
	    sort?: string;
	    include?: string[];
	
	    static createFrom(source: any = {}) {
	        return new ListOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.page = source["page"];
	        this.perPage = source["perPage"];
	        this.filters = source["filters"];
	        this.sort = source["sort"];
	        this.include = source["include"];
	    }
	}
	export class Location {
	    id: number;
	    short: string;
	    long: string;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	
	    static createFrom(source: any = {}) {
	        return new Location(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.short = source["short"];
	        this.long = source["long"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Nest {
	    id: number;
	    uuid: string;
	    author: string;
	    name: string;
	    description: string;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	
	    static createFrom(source: any = {}) {
	        return new Nest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.uuid = source["uuid"];
	        this.author = source["author"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Node {
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
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	    // Go type: struct { Memory int "json:\"memory\""; Disk int "json:\"disk\"" }
	    allocated_resources?: any;
	
	    static createFrom(source: any = {}) {
	        return new Node(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.uuid = source["uuid"];
	        this.public = source["public"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.location_id = source["location_id"];
	        this.fqdn = source["fqdn"];
	        this.scheme = source["scheme"];
	        this.behind_proxy = source["behind_proxy"];
	        this.maintenance_mode = source["maintenance_mode"];
	        this.memory = source["memory"];
	        this.memory_overallocate = source["memory_overallocate"];
	        this.disk = source["disk"];
	        this.disk_overallocate = source["disk_overallocate"];
	        this.upload_size = source["upload_size"];
	        this.daemon_listen = source["daemon_listen"];
	        this.daemon_sftp = source["daemon_sftp"];
	        this.daemon_base = source["daemon_base"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	        this.allocated_resources = this.convertValues(source["allocated_resources"], Object);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class NodeAllocation {
	    id: number;
	    ip: string;
	    alias?: string;
	    port: number;
	    notes?: string;
	    assigned: boolean;
	
	    static createFrom(source: any = {}) {
	        return new NodeAllocation(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.ip = source["ip"];
	        this.alias = source["alias"];
	        this.port = source["port"];
	        this.notes = source["notes"];
	        this.assigned = source["assigned"];
	    }
	}
	export class NodeConfiguration {
	    debug: boolean;
	    uuid: string;
	    token_id: string;
	    token: string;
	    // Go type: struct { Host string "json:\"host\""; Port int "json:\"port\""; UploadLimit int "json:\"upload_limit\""; SSL struct { Enabled bool "json:\"enabled\""; Cert string "json:\"cert\""; Key string "json:\"key\"" } "json:\"ssl\"" }
	    api: any;
	    // Go type: struct { Data string "json:\"data\""; SFTP struct { BindPort int "json:\"bind_port\"" } "json:\"sftp\"" }
	    system: any;
	    allowed_mounts: string[];
	    remote: string;
	
	    static createFrom(source: any = {}) {
	        return new NodeConfiguration(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.debug = source["debug"];
	        this.uuid = source["uuid"];
	        this.token_id = source["token_id"];
	        this.token = source["token"];
	        this.api = this.convertValues(source["api"], Object);
	        this.system = this.convertValues(source["system"], Object);
	        this.allowed_mounts = source["allowed_mounts"];
	        this.remote = source["remote"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class NodeHealthStatus {
	    nodeId: number;
	    reachable: boolean;
	    latencyMs: number;
	    statusCode?: number;
	    error?: string;
	    checkedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new NodeHealthStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.nodeId = source["nodeId"];
	        this.reachable = source["reachable"];
	        this.latencyMs = source["latencyMs"];
	        this.statusCode = source["statusCode"];
	        this.error = source["error"];
	        this.checkedAt = source["checkedAt"];
	    }
	}
	export class PaginationMeta {
	    total: number;
	    count: number;
	    per_page: number;
	    current_page: number;
	    total_pages: number;
	
	    static createFrom(source: any = {}) {
	        return new PaginationMeta(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.total = source["total"];
	        this.count = source["count"];
	        this.per_page = source["per_page"];
	        this.current_page = source["current_page"];
	        this.total_pages = source["total_pages"];
	    }
	}
	export class PaginatedResult_pterodesk_internal_api_AppDatabase_ {
	    items: AppDatabase[];
	    pagination: PaginationMeta;
	
	    static createFrom(source: any = {}) {
	        return new PaginatedResult_pterodesk_internal_api_AppDatabase_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.items = this.convertValues(source["items"], AppDatabase);
	        this.pagination = this.convertValues(source["pagination"], PaginationMeta);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PaginatedResult_pterodesk_internal_api_AppServer_ {
	    items: AppServer[];
	    pagination: PaginationMeta;
	
	    static createFrom(source: any = {}) {
	        return new PaginatedResult_pterodesk_internal_api_AppServer_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.items = this.convertValues(source["items"], AppServer);
	        this.pagination = this.convertValues(source["pagination"], PaginationMeta);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PaginatedResult_pterodesk_internal_api_Egg_ {
	    items: Egg[];
	    pagination: PaginationMeta;
	
	    static createFrom(source: any = {}) {
	        return new PaginatedResult_pterodesk_internal_api_Egg_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.items = this.convertValues(source["items"], Egg);
	        this.pagination = this.convertValues(source["pagination"], PaginationMeta);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PaginatedResult_pterodesk_internal_api_Location_ {
	    items: Location[];
	    pagination: PaginationMeta;
	
	    static createFrom(source: any = {}) {
	        return new PaginatedResult_pterodesk_internal_api_Location_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.items = this.convertValues(source["items"], Location);
	        this.pagination = this.convertValues(source["pagination"], PaginationMeta);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PaginatedResult_pterodesk_internal_api_Nest_ {
	    items: Nest[];
	    pagination: PaginationMeta;
	
	    static createFrom(source: any = {}) {
	        return new PaginatedResult_pterodesk_internal_api_Nest_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.items = this.convertValues(source["items"], Nest);
	        this.pagination = this.convertValues(source["pagination"], PaginationMeta);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PaginatedResult_pterodesk_internal_api_NodeAllocation_ {
	    items: NodeAllocation[];
	    pagination: PaginationMeta;
	
	    static createFrom(source: any = {}) {
	        return new PaginatedResult_pterodesk_internal_api_NodeAllocation_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.items = this.convertValues(source["items"], NodeAllocation);
	        this.pagination = this.convertValues(source["pagination"], PaginationMeta);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PaginatedResult_pterodesk_internal_api_Node_ {
	    items: Node[];
	    pagination: PaginationMeta;
	
	    static createFrom(source: any = {}) {
	        return new PaginatedResult_pterodesk_internal_api_Node_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.items = this.convertValues(source["items"], Node);
	        this.pagination = this.convertValues(source["pagination"], PaginationMeta);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class User {
	    id: number;
	    external_id?: string;
	    uuid: string;
	    username: string;
	    email: string;
	    first_name: string;
	    last_name: string;
	    language: string;
	    root_admin: boolean;
	    "2fa": boolean;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	
	    static createFrom(source: any = {}) {
	        return new User(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.external_id = source["external_id"];
	        this.uuid = source["uuid"];
	        this.username = source["username"];
	        this.email = source["email"];
	        this.first_name = source["first_name"];
	        this.last_name = source["last_name"];
	        this.language = source["language"];
	        this.root_admin = source["root_admin"];
	        this["2fa"] = source["2fa"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PaginatedResult_pterodesk_internal_api_User_ {
	    items: User[];
	    pagination: PaginationMeta;
	
	    static createFrom(source: any = {}) {
	        return new PaginatedResult_pterodesk_internal_api_User_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.items = this.convertValues(source["items"], User);
	        this.pagination = this.convertValues(source["pagination"], PaginationMeta);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class ResourceUsage {
	    current_state: string;
	    is_suspended: boolean;
	    // Go type: struct { MemoryBytes int64 "json:\"memory_bytes\""; CPUAbsolute float64 "json:\"cpu_absolute\""; DiskBytes int64 "json:\"disk_bytes\""; NetworkRxBytes int64 "json:\"network_rx_bytes\""; NetworkTxBytes int64 "json:\"network_tx_bytes\""; Uptime int64 "json:\"uptime\"" }
	    resources: any;
	
	    static createFrom(source: any = {}) {
	        return new ResourceUsage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.current_state = source["current_state"];
	        this.is_suspended = source["is_suspended"];
	        this.resources = this.convertValues(source["resources"], Object);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SFTPDetails {
	    ip: string;
	    port: number;
	
	    static createFrom(source: any = {}) {
	        return new SFTPDetails(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ip = source["ip"];
	        this.port = source["port"];
	    }
	}
	export class ScheduleTask {
	    id: number;
	    sequence_id: number;
	    action: string;
	    payload: string;
	    time_offset: number;
	    is_queued: boolean;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	
	    static createFrom(source: any = {}) {
	        return new ScheduleTask(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.sequence_id = source["sequence_id"];
	        this.action = source["action"];
	        this.payload = source["payload"];
	        this.time_offset = source["time_offset"];
	        this.is_queued = source["is_queued"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Schedule {
	    id: number;
	    name: string;
	    cron: CronExpression;
	    is_active: boolean;
	    is_processing: boolean;
	    only_when_online: boolean;
	    // Go type: time
	    last_run_at?: any;
	    // Go type: time
	    next_run_at?: any;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	    tasks?: ScheduleTask[];
	
	    static createFrom(source: any = {}) {
	        return new Schedule(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.cron = this.convertValues(source["cron"], CronExpression);
	        this.is_active = source["is_active"];
	        this.is_processing = source["is_processing"];
	        this.only_when_online = source["only_when_online"];
	        this.last_run_at = this.convertValues(source["last_run_at"], null);
	        this.next_run_at = this.convertValues(source["next_run_at"], null);
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	        this.tasks = this.convertValues(source["tasks"], ScheduleTask);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class ServerRelationships {
	    egg?: EggRelationship;
	    allocations?: AllocationsRelationship;
	
	    static createFrom(source: any = {}) {
	        return new ServerRelationships(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.egg = this.convertValues(source["egg"], EggRelationship);
	        this.allocations = this.convertValues(source["allocations"], AllocationsRelationship);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Server {
	    server_owner: boolean;
	    identifier: string;
	    internal_id?: number;
	    uuid: string;
	    name: string;
	    node: string;
	    description: string;
	    limits: ServerLimits;
	    allocations?: Allocation[];
	    feature_limits: FeatureLimits;
	    status?: string;
	    is_suspended: boolean;
	    is_installing: boolean;
	    is_transferring: boolean;
	    invocation?: string;
	    docker_image?: string;
	    egg_features?: string[];
	    egg_name?: string;
	    user_permissions?: string[];
	    relationships?: ServerRelationships;
	    sftp_details?: SFTPDetails;
	
	    static createFrom(source: any = {}) {
	        return new Server(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.server_owner = source["server_owner"];
	        this.identifier = source["identifier"];
	        this.internal_id = source["internal_id"];
	        this.uuid = source["uuid"];
	        this.name = source["name"];
	        this.node = source["node"];
	        this.description = source["description"];
	        this.limits = this.convertValues(source["limits"], ServerLimits);
	        this.allocations = this.convertValues(source["allocations"], Allocation);
	        this.feature_limits = this.convertValues(source["feature_limits"], FeatureLimits);
	        this.status = source["status"];
	        this.is_suspended = source["is_suspended"];
	        this.is_installing = source["is_installing"];
	        this.is_transferring = source["is_transferring"];
	        this.invocation = source["invocation"];
	        this.docker_image = source["docker_image"];
	        this.egg_features = source["egg_features"];
	        this.egg_name = source["egg_name"];
	        this.user_permissions = source["user_permissions"];
	        this.relationships = this.convertValues(source["relationships"], ServerRelationships);
	        this.sftp_details = this.convertValues(source["sftp_details"], SFTPDetails);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	export class StartupVariable {
	    name: string;
	    description: string;
	    env_variable: string;
	    default_value: string;
	    server_value: string;
	    is_editable: boolean;
	    rules: string;
	
	    static createFrom(source: any = {}) {
	        return new StartupVariable(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.description = source["description"];
	        this.env_variable = source["env_variable"];
	        this.default_value = source["default_value"];
	        this.server_value = source["server_value"];
	        this.is_editable = source["is_editable"];
	        this.rules = source["rules"];
	    }
	}
	export class ServerStartupConfig {
	    startup_command: string;
	    raw_startup_command: string;
	    docker_images: Record<string, string>;
	    variables: StartupVariable[];
	
	    static createFrom(source: any = {}) {
	        return new ServerStartupConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.startup_command = source["startup_command"];
	        this.raw_startup_command = source["raw_startup_command"];
	        this.docker_images = source["docker_images"];
	        this.variables = this.convertValues(source["variables"], StartupVariable);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class Subuser {
	    uuid: string;
	    username: string;
	    email: string;
	    image: string;
	    "2fa_enabled": boolean;
	    // Go type: time
	    created_at: any;
	    permissions: string[];
	
	    static createFrom(source: any = {}) {
	        return new Subuser(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.uuid = source["uuid"];
	        this.username = source["username"];
	        this.email = source["email"];
	        this.image = source["image"];
	        this["2fa_enabled"] = source["2fa_enabled"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.permissions = source["permissions"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class TwoFactorDetails {
	    image_url_data: string;
	    secret: string;
	
	    static createFrom(source: any = {}) {
	        return new TwoFactorDetails(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.image_url_data = source["image_url_data"];
	        this.secret = source["secret"];
	    }
	}
	export class UpdateServerBuildRequest {
	    allocation: number;
	    oom_disabled: boolean;
	    memory: number;
	    swap: number;
	    disk: number;
	    io: number;
	    cpu: number;
	    threads?: string;
	    feature_limits: FeatureLimits;
	    add_allocations?: number[];
	    remove_allocations?: number[];
	
	    static createFrom(source: any = {}) {
	        return new UpdateServerBuildRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.allocation = source["allocation"];
	        this.oom_disabled = source["oom_disabled"];
	        this.memory = source["memory"];
	        this.swap = source["swap"];
	        this.disk = source["disk"];
	        this.io = source["io"];
	        this.cpu = source["cpu"];
	        this.threads = source["threads"];
	        this.feature_limits = this.convertValues(source["feature_limits"], FeatureLimits);
	        this.add_allocations = source["add_allocations"];
	        this.remove_allocations = source["remove_allocations"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class UpdateServerDetailsRequest {
	    name: string;
	    user: number;
	    external_id?: string;
	    description: string;
	
	    static createFrom(source: any = {}) {
	        return new UpdateServerDetailsRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.user = source["user"];
	        this.external_id = source["external_id"];
	        this.description = source["description"];
	    }
	}
	export class UpdateServerStartupRequest {
	    startup: string;
	    environment: Record<string, any>;
	    egg: number;
	    image: string;
	    skip_scripts: boolean;
	
	    static createFrom(source: any = {}) {
	        return new UpdateServerStartupRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.startup = source["startup"];
	        this.environment = source["environment"];
	        this.egg = source["egg"];
	        this.image = source["image"];
	        this.skip_scripts = source["skip_scripts"];
	    }
	}
	export class UpdateUserRequest {
	    email: string;
	    username: string;
	    first_name: string;
	    last_name: string;
	    password?: string;
	    language?: string;
	    root_admin: boolean;
	    external_id?: string;
	
	    static createFrom(source: any = {}) {
	        return new UpdateUserRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.email = source["email"];
	        this.username = source["username"];
	        this.first_name = source["first_name"];
	        this.last_name = source["last_name"];
	        this.password = source["password"];
	        this.language = source["language"];
	        this.root_admin = source["root_admin"];
	        this.external_id = source["external_id"];
	    }
	}

}

export namespace database {
	
	export class ActivityRecord {
	    id: number;
	    panelId: string;
	    panelName: string;
	    serverId: string;
	    action: string;
	    result: string;
	    error: string;
	    // Go type: time
	    timestamp: any;
	
	    static createFrom(source: any = {}) {
	        return new ActivityRecord(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.panelId = source["panelId"];
	        this.panelName = source["panelName"];
	        this.serverId = source["serverId"];
	        this.action = source["action"];
	        this.result = source["result"];
	        this.error = source["error"];
	        this.timestamp = this.convertValues(source["timestamp"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class RecentServerRecord {
	    panelId: string;
	    serverId: string;
	    serverName: string;
	    // Go type: time
	    accessedAt: any;
	
	    static createFrom(source: any = {}) {
	        return new RecentServerRecord(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.panelId = source["panelId"];
	        this.serverId = source["serverId"];
	        this.serverName = source["serverName"];
	        this.accessedAt = this.convertValues(source["accessedAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace discovery {
	
	export class PanelCapabilities {
	    has_client_api: boolean;
	    has_application_api: boolean;
	    is_v2: boolean;
	    can_view_servers: boolean;
	    can_power_action: boolean;
	    can_console: boolean;
	    can_file_manager: boolean;
	    can_sftp: boolean;
	    can_manage_backups: boolean;
	    can_manage_databases: boolean;
	    can_manage_schedules: boolean;
	    can_manage_subusers: boolean;
	    can_admin_servers: boolean;
	    can_create_servers: boolean;
	    can_manage_nodes: boolean;
	    can_manage_allocations: boolean;
	    can_manage_nests: boolean;
	
	    static createFrom(source: any = {}) {
	        return new PanelCapabilities(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.has_client_api = source["has_client_api"];
	        this.has_application_api = source["has_application_api"];
	        this.is_v2 = source["is_v2"];
	        this.can_view_servers = source["can_view_servers"];
	        this.can_power_action = source["can_power_action"];
	        this.can_console = source["can_console"];
	        this.can_file_manager = source["can_file_manager"];
	        this.can_sftp = source["can_sftp"];
	        this.can_manage_backups = source["can_manage_backups"];
	        this.can_manage_databases = source["can_manage_databases"];
	        this.can_manage_schedules = source["can_manage_schedules"];
	        this.can_manage_subusers = source["can_manage_subusers"];
	        this.can_admin_servers = source["can_admin_servers"];
	        this.can_create_servers = source["can_create_servers"];
	        this.can_manage_nodes = source["can_manage_nodes"];
	        this.can_manage_allocations = source["can_manage_allocations"];
	        this.can_manage_nests = source["can_manage_nests"];
	    }
	}
	export class PanelVersion {
	    raw: string;
	    major: number;
	    minor: number;
	    patch: number;
	    pre_release: string;
	    is_v2: boolean;
	    detected: boolean;
	
	    static createFrom(source: any = {}) {
	        return new PanelVersion(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.raw = source["raw"];
	        this.major = source["major"];
	        this.minor = source["minor"];
	        this.patch = source["patch"];
	        this.pre_release = source["pre_release"];
	        this.is_v2 = source["is_v2"];
	        this.detected = source["detected"];
	    }
	}
	export class CompatibilityReport {
	    version: PanelVersion;
	    supported_features: string[];
	    deprecated_features: string[];
	    unavailable_features: string[];
	    migration_notes: string[];
	    capabilities: PanelCapabilities;
	
	    static createFrom(source: any = {}) {
	        return new CompatibilityReport(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.version = this.convertValues(source["version"], PanelVersion);
	        this.supported_features = source["supported_features"];
	        this.deprecated_features = source["deprecated_features"];
	        this.unavailable_features = source["unavailable_features"];
	        this.migration_notes = source["migration_notes"];
	        this.capabilities = this.convertValues(source["capabilities"], PanelCapabilities);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class EndpointInfo {
	    name: string;
	    method: string;
	    path: string;
	    category: string;
	    subcategory: string;
	    auth_type: string;
	    permissions: string[];
	    supported_versions: string;
	    request_schema: string;
	    response_schema: string;
	    status: string;
	    source_file: string;
	    notes: string;
	
	    static createFrom(source: any = {}) {
	        return new EndpointInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.method = source["method"];
	        this.path = source["path"];
	        this.category = source["category"];
	        this.subcategory = source["subcategory"];
	        this.auth_type = source["auth_type"];
	        this.permissions = source["permissions"];
	        this.supported_versions = source["supported_versions"];
	        this.request_schema = source["request_schema"];
	        this.response_schema = source["response_schema"];
	        this.status = source["status"];
	        this.source_file = source["source_file"];
	        this.notes = source["notes"];
	    }
	}
	
	
	export class Permission {
	    key: string;
	    category: string;
	    description: string;
	    applies_to: string[];
	
	    static createFrom(source: any = {}) {
	        return new Permission(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.category = source["category"];
	        this.description = source["description"];
	        this.applies_to = source["applies_to"];
	    }
	}
	export class Registry {
	    endpoints: EndpointInfo[];
	
	    static createFrom(source: any = {}) {
	        return new Registry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.endpoints = this.convertValues(source["endpoints"], EndpointInfo);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace main {
	
	export class CustomBackgroundInfo {
	    enabled: boolean;
	    path: string;
	    dataUrl: string;
	    opacity: number;
	    blur: number;
	    scale: number;
	    positionX: number;
	    positionY: number;
	    fitMode: string;
	
	    static createFrom(source: any = {}) {
	        return new CustomBackgroundInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.path = source["path"];
	        this.dataUrl = source["dataUrl"];
	        this.opacity = source["opacity"];
	        this.blur = source["blur"];
	        this.scale = source["scale"];
	        this.positionX = source["positionX"];
	        this.positionY = source["positionY"];
	        this.fitMode = source["fitMode"];
	    }
	}
	export class DebugStatus {
	    tpmAvailable: boolean;
	    tpmEnabled: boolean;
	    dbConnected: boolean;
	    debugLogging: boolean;
	
	    static createFrom(source: any = {}) {
	        return new DebugStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.tpmAvailable = source["tpmAvailable"];
	        this.tpmEnabled = source["tpmEnabled"];
	        this.dbConnected = source["dbConnected"];
	        this.debugLogging = source["debugLogging"];
	    }
	}
	export class DetachedWindowConfig {
	    isDetached: boolean;
	    type: string;
	    server: string;
	    subtab: string;
	    filePath: string;
	    title: string;
	
	    static createFrom(source: any = {}) {
	        return new DetachedWindowConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.isDetached = source["isDetached"];
	        this.type = source["type"];
	        this.server = source["server"];
	        this.subtab = source["subtab"];
	        this.filePath = source["filePath"];
	        this.title = source["title"];
	    }
	}
	export class DiagnosticCheck {
	    id: string;
	    category: string;
	    title: string;
	    status: string;
	    summary: string;
	    detail: string;
	    remediation?: string;
	
	    static createFrom(source: any = {}) {
	        return new DiagnosticCheck(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.category = source["category"];
	        this.title = source["title"];
	        this.status = source["status"];
	        this.summary = source["summary"];
	        this.detail = source["detail"];
	        this.remediation = source["remediation"];
	    }
	}
	export class GitHubReleaseAsset {
	    name: string;
	    size: number;
	    downloadUrl: string;
	    downloadCount: number;
	
	    static createFrom(source: any = {}) {
	        return new GitHubReleaseAsset(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.size = source["size"];
	        this.downloadUrl = source["downloadUrl"];
	        this.downloadCount = source["downloadCount"];
	    }
	}
	export class GitHubReleaseInfo {
	    tagName: string;
	    name: string;
	    body: string;
	    prerelease: boolean;
	    publishedAt: string;
	    htmlUrl: string;
	    hasUpdate: boolean;
	    currentVersion: string;
	    assets: GitHubReleaseAsset[];
	
	    static createFrom(source: any = {}) {
	        return new GitHubReleaseInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.tagName = source["tagName"];
	        this.name = source["name"];
	        this.body = source["body"];
	        this.prerelease = source["prerelease"];
	        this.publishedAt = source["publishedAt"];
	        this.htmlUrl = source["htmlUrl"];
	        this.hasUpdate = source["hasUpdate"];
	        this.currentVersion = source["currentVersion"];
	        this.assets = this.convertValues(source["assets"], GitHubReleaseAsset);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PanelConnectivityDiagnostics {
	    panelId: string;
	    panelName: string;
	    panelUrl: string;
	    scheme: string;
	    dnsResolvedIps: string;
	    dnsLatencyMs: number;
	    dnsError?: string;
	    tlsVersion?: string;
	    tlsCipherSuite?: string;
	    tlsCertExpiry?: string;
	    tlsCertIssuer?: string;
	    tlsValid: boolean;
	    tlsError?: string;
	    clientApiStatus: string;
	    clientApiLatencyMs: number;
	    clientApiError?: string;
	    appApiStatus: string;
	    appApiLatencyMs: number;
	    appApiError?: string;
	    checkedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new PanelConnectivityDiagnostics(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.panelId = source["panelId"];
	        this.panelName = source["panelName"];
	        this.panelUrl = source["panelUrl"];
	        this.scheme = source["scheme"];
	        this.dnsResolvedIps = source["dnsResolvedIps"];
	        this.dnsLatencyMs = source["dnsLatencyMs"];
	        this.dnsError = source["dnsError"];
	        this.tlsVersion = source["tlsVersion"];
	        this.tlsCipherSuite = source["tlsCipherSuite"];
	        this.tlsCertExpiry = source["tlsCertExpiry"];
	        this.tlsCertIssuer = source["tlsCertIssuer"];
	        this.tlsValid = source["tlsValid"];
	        this.tlsError = source["tlsError"];
	        this.clientApiStatus = source["clientApiStatus"];
	        this.clientApiLatencyMs = source["clientApiLatencyMs"];
	        this.clientApiError = source["clientApiError"];
	        this.appApiStatus = source["appApiStatus"];
	        this.appApiLatencyMs = source["appApiLatencyMs"];
	        this.appApiError = source["appApiError"];
	        this.checkedAt = source["checkedAt"];
	    }
	}
	export class SecurityPreferences {
	    auto_lock_minutes: number;
	    lock_on_launch: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SecurityPreferences(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.auto_lock_minutes = source["auto_lock_minutes"];
	        this.lock_on_launch = source["lock_on_launch"];
	    }
	}
	export class SystemDiagnostics {
	    appVersion: string;
	    wailsVersion: string;
	    os: string;
	    osName: string;
	    osDisplayVersion: string;
	    osBuild: string;
	    webView2Version: string;
	    arch: string;
	    cpuCores: number;
	    hostname: string;
	    goVersion: string;
	    uptimeSeconds: number;
	    sqliteVersion: string;
	    appDataDir: string;
	    databasePath: string;
	    databaseSizeBytes: number;
	    databaseWalBytes: number;
	    databaseWalMode: boolean;
	    databaseJournalMode: string;
	    databaseIntegrity: string;
	    logFilesCount: number;
	    logsTotalBytes: number;
	    diskFreeBytes: number;
	    panelsCount: number;
	    activePanelName: string;
	    activePanelUrl: string;
	    activePanelScheme: string;
	    activeHasClientKey: boolean;
	    activeHasAppKey: boolean;
	    consoleWsConnected: boolean;
	    consoleWsServer: string;
	    dpapiActive: boolean;
	    dpapiTestPassed: boolean;
	    dpapiLatencyMs: number;
	    tpmHardwareBacked: boolean;
	    sessionLockEnabled: boolean;
	    sessionLockType: string;
	    securityLockout: boolean;
	    autoWipeEnabled: boolean;
	    failedAttempts: number;
	    allocatedMemMb: number;
	    totalAllocMemMb: number;
	    gcPauseTotalMs: number;
	    numGc: number;
	    goroutinesCount: number;
	    detachedCount: number;
	    recentLogErrors: string[];
	    recentFailedActions: database.ActivityRecord[];
	    healthChecks: DiagnosticCheck[];
	    timestamp: string;
	
	    static createFrom(source: any = {}) {
	        return new SystemDiagnostics(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.appVersion = source["appVersion"];
	        this.wailsVersion = source["wailsVersion"];
	        this.os = source["os"];
	        this.osName = source["osName"];
	        this.osDisplayVersion = source["osDisplayVersion"];
	        this.osBuild = source["osBuild"];
	        this.webView2Version = source["webView2Version"];
	        this.arch = source["arch"];
	        this.cpuCores = source["cpuCores"];
	        this.hostname = source["hostname"];
	        this.goVersion = source["goVersion"];
	        this.uptimeSeconds = source["uptimeSeconds"];
	        this.sqliteVersion = source["sqliteVersion"];
	        this.appDataDir = source["appDataDir"];
	        this.databasePath = source["databasePath"];
	        this.databaseSizeBytes = source["databaseSizeBytes"];
	        this.databaseWalBytes = source["databaseWalBytes"];
	        this.databaseWalMode = source["databaseWalMode"];
	        this.databaseJournalMode = source["databaseJournalMode"];
	        this.databaseIntegrity = source["databaseIntegrity"];
	        this.logFilesCount = source["logFilesCount"];
	        this.logsTotalBytes = source["logsTotalBytes"];
	        this.diskFreeBytes = source["diskFreeBytes"];
	        this.panelsCount = source["panelsCount"];
	        this.activePanelName = source["activePanelName"];
	        this.activePanelUrl = source["activePanelUrl"];
	        this.activePanelScheme = source["activePanelScheme"];
	        this.activeHasClientKey = source["activeHasClientKey"];
	        this.activeHasAppKey = source["activeHasAppKey"];
	        this.consoleWsConnected = source["consoleWsConnected"];
	        this.consoleWsServer = source["consoleWsServer"];
	        this.dpapiActive = source["dpapiActive"];
	        this.dpapiTestPassed = source["dpapiTestPassed"];
	        this.dpapiLatencyMs = source["dpapiLatencyMs"];
	        this.tpmHardwareBacked = source["tpmHardwareBacked"];
	        this.sessionLockEnabled = source["sessionLockEnabled"];
	        this.sessionLockType = source["sessionLockType"];
	        this.securityLockout = source["securityLockout"];
	        this.autoWipeEnabled = source["autoWipeEnabled"];
	        this.failedAttempts = source["failedAttempts"];
	        this.allocatedMemMb = source["allocatedMemMb"];
	        this.totalAllocMemMb = source["totalAllocMemMb"];
	        this.gcPauseTotalMs = source["gcPauseTotalMs"];
	        this.numGc = source["numGc"];
	        this.goroutinesCount = source["goroutinesCount"];
	        this.detachedCount = source["detachedCount"];
	        this.recentLogErrors = source["recentLogErrors"];
	        this.recentFailedActions = this.convertValues(source["recentFailedActions"], database.ActivityRecord);
	        this.healthChecks = this.convertValues(source["healthChecks"], DiagnosticCheck);
	        this.timestamp = source["timestamp"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class WindowState {
	    width: number;
	    height: number;
	    x: number;
	    y: number;
	    is_maximised: boolean;
	
	    static createFrom(source: any = {}) {
	        return new WindowState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.width = source["width"];
	        this.height = source["height"];
	        this.x = source["x"];
	        this.y = source["y"];
	        this.is_maximised = source["is_maximised"];
	    }
	}

}

export namespace panel {
	
	export class ConnectionTestResult {
	    clientApi: boolean;
	    clientError?: string;
	    appApi: boolean;
	    appError?: string;
	    version?: string;
	    accountName?: string;
	    accountEmail?: string;
	    accountAdmin?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ConnectionTestResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.clientApi = source["clientApi"];
	        this.clientError = source["clientError"];
	        this.appApi = source["appApi"];
	        this.appError = source["appError"];
	        this.version = source["version"];
	        this.accountName = source["accountName"];
	        this.accountEmail = source["accountEmail"];
	        this.accountAdmin = source["accountAdmin"];
	    }
	}
	export class DashboardStats {
	    totalPanels: number;
	    activePanel: string;
	    activePanelName: string;
	    totalServers: number;
	    runningServers: number;
	    offlineServers: number;
	    totalNodes: number;
	
	    static createFrom(source: any = {}) {
	        return new DashboardStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.totalPanels = source["totalPanels"];
	        this.activePanel = source["activePanel"];
	        this.activePanelName = source["activePanelName"];
	        this.totalServers = source["totalServers"];
	        this.runningServers = source["runningServers"];
	        this.offlineServers = source["offlineServers"];
	        this.totalNodes = source["totalNodes"];
	    }
	}
	export class Panel {
	    id: string;
	    name: string;
	    url: string;
	    clientApiKey?: string;
	    appApiKey?: string;
	    version: string;
	    isActive: boolean;
	    hasClientKey: boolean;
	    hasAppKey: boolean;
	    maskedClientKey?: string;
	    maskedAppKey?: string;
	    // Go type: time
	    createdAt: any;
	    // Go type: time
	    updatedAt: any;
	
	    static createFrom(source: any = {}) {
	        return new Panel(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.url = source["url"];
	        this.clientApiKey = source["clientApiKey"];
	        this.appApiKey = source["appApiKey"];
	        this.version = source["version"];
	        this.isActive = source["isActive"];
	        this.hasClientKey = source["hasClientKey"];
	        this.hasAppKey = source["hasAppKey"];
	        this.maskedClientKey = source["maskedClientKey"];
	        this.maskedAppKey = source["maskedAppKey"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.updatedAt = this.convertValues(source["updatedAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PanelInput {
	    name: string;
	    url: string;
	    clientApiKey?: string;
	    appApiKey?: string;
	
	    static createFrom(source: any = {}) {
	        return new PanelInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.url = source["url"];
	        this.clientApiKey = source["clientApiKey"];
	        this.appApiKey = source["appApiKey"];
	    }
	}

}

export namespace security {
	
	export class LockoutConfig {
	    enable_lockout: boolean;
	    max_attempts: number;
	    lockout_duration_minutes: number;
	    enable_auto_wipe: boolean;
	    wipe_attempts: number;
	
	    static createFrom(source: any = {}) {
	        return new LockoutConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enable_lockout = source["enable_lockout"];
	        this.max_attempts = source["max_attempts"];
	        this.lockout_duration_minutes = source["lockout_duration_minutes"];
	        this.enable_auto_wipe = source["enable_auto_wipe"];
	        this.wipe_attempts = source["wipe_attempts"];
	    }
	}
	export class LockoutStatus {
	    is_locked_out: boolean;
	    remaining_lockout_seconds: number;
	    failed_attempts: number;
	    consecutive_fails: number;
	    max_attempts: number;
	    lockout_duration_minutes: number;
	    enable_lockout: boolean;
	    enable_auto_wipe: boolean;
	    wipe_attempts: number;
	    data_wiped: boolean;
	
	    static createFrom(source: any = {}) {
	        return new LockoutStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.is_locked_out = source["is_locked_out"];
	        this.remaining_lockout_seconds = source["remaining_lockout_seconds"];
	        this.failed_attempts = source["failed_attempts"];
	        this.consecutive_fails = source["consecutive_fails"];
	        this.max_attempts = source["max_attempts"];
	        this.lockout_duration_minutes = source["lockout_duration_minutes"];
	        this.enable_lockout = source["enable_lockout"];
	        this.enable_auto_wipe = source["enable_auto_wipe"];
	        this.wipe_attempts = source["wipe_attempts"];
	        this.data_wiped = source["data_wiped"];
	    }
	}

}

