package discovery

// Permission represents a defined Pterodactyl permission key
type Permission struct {
	Key         string   `json:"key"`
	Category    string   `json:"category"`
	Description string   `json:"description"`
	AppliesTo   []string `json:"applies_to"` // "client", "server", "admin"
}

// ClientPermissions contains the comprehensive list of official Pterodactyl Client API permissions
// Source: Pterodactyl 1.x /app/Services/Acl/Acl.php and panel route middleware
var ClientPermissions = []Permission{
	// Control
	{Key: "control.console", Category: "Control", Description: "Connect to the server console and view output", AppliesTo: []string{"server"}},
	{Key: "control.start", Category: "Control", Description: "Power on the server", AppliesTo: []string{"server"}},
	{Key: "control.stop", Category: "Control", Description: "Gracefully stop the server", AppliesTo: []string{"server"}},
	{Key: "control.restart", Category: "Control", Description: "Restart the server instance", AppliesTo: []string{"server"}},

	// User / Subuser
	{Key: "user.create", Category: "Subusers", Description: "Invite subusers to access the server", AppliesTo: []string{"server"}},
	{Key: "user.read", Category: "Subusers", Description: "View existing subusers and permissions", AppliesTo: []string{"server"}},
	{Key: "user.update", Category: "Subusers", Description: "Modify permissions of subusers", AppliesTo: []string{"server"}},
	{Key: "user.delete", Category: "Subusers", Description: "Remove subusers from the server", AppliesTo: []string{"server"}},

	// Files
	{Key: "file.create", Category: "Files", Description: "Create new files and directories", AppliesTo: []string{"server"}},
	{Key: "file.read", Category: "Files", Description: "List directory contents", AppliesTo: []string{"server"}},
	{Key: "file.read-content", Category: "Files", Description: "Read and inspect contents of files", AppliesTo: []string{"server"}},
	{Key: "file.update", Category: "Files", Description: "Save and write changes to files", AppliesTo: []string{"server"}},
	{Key: "file.delete", Category: "Files", Description: "Delete files and directories", AppliesTo: []string{"server"}},
	{Key: "file.archive", Category: "Files", Description: "Compress and extract archive files", AppliesTo: []string{"server"}},
	{Key: "file.sftp", Category: "Files", Description: "Connect directly using SFTP protocol", AppliesTo: []string{"server"}},

	// Backups
	{Key: "backup.create", Category: "Backups", Description: "Create new server backups", AppliesTo: []string{"server"}},
	{Key: "backup.read", Category: "Backups", Description: "View server backups and lock status", AppliesTo: []string{"server"}},
	{Key: "backup.delete", Category: "Backups", Description: "Delete server backups", AppliesTo: []string{"server"}},
	{Key: "backup.download", Category: "Backups", Description: "Download server backup archives", AppliesTo: []string{"server"}},
	{Key: "backup.restore", Category: "Backups", Description: "Restore server files from a backup", AppliesTo: []string{"server"}},

	// Allocations
	{Key: "allocation.read", Category: "Allocations", Description: "View assigned IP and port allocations", AppliesTo: []string{"server"}},
	{Key: "allocation.create", Category: "Allocations", Description: "Assign additional ports to server", AppliesTo: []string{"server"}},
	{Key: "allocation.update", Category: "Allocations", Description: "Set primary port allocation or add notes", AppliesTo: []string{"server"}},
	{Key: "allocation.delete", Category: "Allocations", Description: "Unassign ports from the server", AppliesTo: []string{"server"}},

	// Startup
	{Key: "startup.read", Category: "Startup", Description: "View startup command and environment variables", AppliesTo: []string{"server"}},
	{Key: "startup.update", Category: "Startup", Description: "Modify startup command and environment variables", AppliesTo: []string{"server"}},
	{Key: "startup.docker-image", Category: "Startup", Description: "Modify the Docker image used when running the server", AppliesTo: []string{"server"}},

	// Plugins
	{Key: "plugin.read", Category: "Plugins", Description: "View plugin catalog and installed plugins", AppliesTo: []string{"server"}},
	{Key: "plugin.download", Category: "Plugins", Description: "Install and manage server plugins", AppliesTo: []string{"server"}},

	// Database
	{Key: "database.create", Category: "Databases", Description: "Create MySQL databases for the server", AppliesTo: []string{"server"}},
	{Key: "database.read", Category: "Databases", Description: "List database hosts and names", AppliesTo: []string{"server"}},
	{Key: "database.update", Category: "Databases", Description: "Rotate database password", AppliesTo: []string{"server"}},
	{Key: "database.delete", Category: "Databases", Description: "Delete MySQL databases", AppliesTo: []string{"server"}},
	{Key: "database.view_password", Category: "Databases", Description: "View generated database password", AppliesTo: []string{"server"}},

	// Schedules
	{Key: "schedule.create", Category: "Schedules", Description: "Create scheduled tasks and crons", AppliesTo: []string{"server"}},
	{Key: "schedule.read", Category: "Schedules", Description: "View scheduled tasks and execution logs", AppliesTo: []string{"server"}},
	{Key: "schedule.update", Category: "Schedules", Description: "Edit schedule parameters and tasks", AppliesTo: []string{"server"}},
	{Key: "schedule.delete", Category: "Schedules", Description: "Delete scheduled tasks", AppliesTo: []string{"server"}},

	// Settings
	{Key: "settings.rename", Category: "Settings", Description: "Rename the server display name", AppliesTo: []string{"server"}},
	{Key: "settings.reinstall", Category: "Settings", Description: "Trigger full server reinstallation", AppliesTo: []string{"server"}},

	// Activity
	{Key: "activity.read", Category: "Activity", Description: "View the activity logs for the server", AppliesTo: []string{"server"}},
}
