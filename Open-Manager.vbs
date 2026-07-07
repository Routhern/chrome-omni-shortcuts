' 숏컷 매니저를 백그라운드에서 실행합니다.
' 더블클릭으로 실행하면 명령창 없이 Node.js 서버가 시작되고 브라우저가 자동으로 열립니다.

Option Explicit

Const WINDOW_HIDDEN = 0
Const ICON_ERROR = 16

Dim objShell
Dim objFSO
Dim strScriptDir
Dim strManagerScript
Dim intWhereExitCode
Dim strCommand

Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' 현재 스크립트의 디렉터리를 기준으로 작업 디렉터리 설정
strScriptDir = objFSO.GetParentFolderName(WScript.ScriptFullName)
objShell.CurrentDirectory = strScriptDir
strManagerScript = objFSO.BuildPath(strScriptDir, "scripts\manager.js")

' 필수 스크립트 존재 여부 확인
If Not objFSO.FileExists(strManagerScript) Then
	objShell.Popup "scripts\manager.js 파일을 찾을 수 없습니다." & vbCrLf & strManagerScript, 0, "Open-Manager", ICON_ERROR
	WScript.Quit 1
End If

' Node.js 실행 가능 여부 확인
intWhereExitCode = objShell.Run("cmd /c where node >nul 2>nul", WINDOW_HIDDEN, True)
If intWhereExitCode <> 0 Then
	objShell.Popup "Node.js가 필요합니다. https://nodejs.org/ 에서 설치해 주세요.", 0, "Open-Manager", ICON_ERROR
	WScript.Quit 1
End If

' node scripts\manager.js 실행 (백그라운드, 명령창 숨김)
strCommand = "cmd /c cd /d """ & strScriptDir & """ && node scripts\manager.js"
objShell.Run strCommand, WINDOW_HIDDEN, False
