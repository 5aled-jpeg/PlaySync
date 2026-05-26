Set WshShell = CreateObject("WScript.Shell")
' Use the full absolute path to the batch launcher (note the missing backslash was the cause of the error)
WshShell.Run chr(34) & "c:\\Users\\khaled\\Desktop\\PlaySync\\Launch_DesktopApp.bat" & chr(34), 0
Set WshShell = Nothing
