//go:build windows

package main

import (
	"os/exec"
	"syscall"
)

// setIndependentProcessFlags configures process creation flags on Windows
// so the child process starts independently of the parent process.
func setIndependentProcessFlags(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: syscall.CREATE_NEW_PROCESS_GROUP,
	}
}
