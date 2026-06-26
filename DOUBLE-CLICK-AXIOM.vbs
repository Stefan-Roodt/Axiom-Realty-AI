Set shell = CreateObject("WScript.Shell")
project = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
command = "cmd.exe /c ""cd /d " & project & " && START-DEVELOPING.cmd"""
shell.Run command, 1, False
