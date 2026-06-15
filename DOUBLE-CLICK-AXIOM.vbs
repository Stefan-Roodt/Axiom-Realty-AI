Set shell = CreateObject("WScript.Shell")
project = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
command = "cmd.exe /k ""cd /d " & project & " && START-AXIOM-PERMANENT.cmd"""
shell.Run command, 1, False
