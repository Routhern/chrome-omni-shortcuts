Option Explicit
Dim shell, fso, page
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
page = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), "src\manager\index.html")
shell.Run Chr(34) & page & Chr(34), 1, False
