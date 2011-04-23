' Set Option Strict on as this really speeds up performance in vb.net and helps you create good code
Option Strict On

Imports System.Net
Imports System.Net.Sockets
Imports System.Threading
Imports System.Text
Imports System.IO

    Public Class Webserver

        Private DoStop As Boolean = False
        Public Port As Integer

        Public Event DeviceIDDetected(ByVal DeviceID As String)
        Public Event StatusUpdate(ByVal sStatus As String)
        Public Event DataReceived(ByVal Data As String)

        Private t As Thread
        Private ss As Socket

        Public Sub New(Optional ByVal thePort As Integer = 8021)
            Port = thePort
        End Sub

        Public Sub StopServer()

            Try
                ss.Shutdown(SocketShutdown.Both)
            Catch ex As Exception
            End Try

            ss.Close()
            t.Abort()

            RaiseEvent StatusUpdate("stopped")
        End Sub

        Public Sub StartServer()
            ' Start the webserver on a thread then exit
            t = New Thread(AddressOf ServerRunning)

            ' Run the service thread in the background as low priority, as to not take up the processor
            t.IsBackground = True
            t.Priority = ThreadPriority.BelowNormal
            t.Start()
        End Sub

        Public Sub ServerRunning()

            ' map the end point with IP Address and Port
            Dim EndPoint As IPEndPoint = New IPEndPoint(IPAddress.Any, Me.Port)

            ' Create a new socket and bind it to the address and port and listen.
            ss = New Socket(AddressFamily.InterNetwork, SocketType.Stream, ProtocolType.Tcp)
            ss.Bind(EndPoint)
            ss.Listen(100)

            Dim WebRoot As String = My.Application.Info.DirectoryPath

            RaiseEvent StatusUpdate("started")
            Try
                While True
                    ' Wait for an incoming connections
                    Dim sock As Socket = ss.Accept()

                    ' Connection accepted
                    ' Initialise the Server class
                    Dim ServerRun As New WebHTTPServer(sock, WebRoot)
                    AddHandler ServerRun.DataReceived, AddressOf HTTPActivity
                    AddHandler ServerRun.DeviceIDDetected, AddressOf HTTPDeviceID
                    AddHandler ServerRun.StatusUpdate, AddressOf HTTPStatus

                    ' Create a new thread to handle the connection
                    Dim t2 As Thread = New Thread(AddressOf ServerRun.HandleConnection)

                    t2.IsBackground = True
                    t2.Priority = ThreadPriority.BelowNormal
                    t2.Start()

                    ' Loop and wait for more connections
                End While
            Catch ex As Exception
                'MsgBox(ex.ToString)
            End Try
        End Sub

        Public Sub HTTPActivity(ByVal Data As String)
            RaiseEvent DataReceived(Data)
        End Sub

        Public Sub HTTPDeviceID(ByVal DeviceID As String)
            RaiseEvent DeviceIDDetected(DeviceID)
        End Sub

        Public Sub HTTPStatus(ByVal Status As String)
            RaiseEvent StatusUpdate(Status)
        End Sub
    End Class

    Public Class WebHTTPServer

        Private sMyWebServerRoot As String
        Private mySocket As Socket
        Private _DefaultPage As String
        Public Event DeviceIDDetected(ByVal DeviceID As String)
        Public Event StatusUpdate(ByVal sStatus As String)
        Public Event DataReceived(ByVal Data As String)

        Public Sub New(ByVal s As Socket, ByVal Location As String, Optional ByVal DefaultPage As String = "")
            mySocket = s
            If Microsoft.VisualBasic.Right(Location, 1) = "\" Then
                Location = Mid(Location, 1, Len(Location) - 1)
            End If
            sMyWebServerRoot = Location & "\"
            _DefaultPage = DefaultPage
        End Sub
        Public Function GetMimeType(ByVal filename As String) As String
            Dim ext As String
            If InStr(filename, ".") > 0 And InStr(filename, ".") < Len(filename) Then
                ext = Mid(filename, InStrRev(filename, ".") + 1)
            Else
                ext = ""
            End If
            ext = LCase(ext)
            Select Case ext
                Case Is = "htm"
                    Return "text/html"
                Case Is = "js"
                    Return "text/html"
                Case Is = "html"
                    Return "text/html"
                Case Is = "txt"
                    Return "text/html"
                Case Is = "jpg"
                    Return "image/jpeg"
                Case Is = "jpeg"
                    Return "image/jpeg"
                Case Is = "png"
                    Return "image/png"
                Case Is = "bmp"
                    Return "image/bmp"
                Case Is = "gif"
                    Return "image/gif"
                Case Is = "gui"
                    Return "text/xml"
                Case Is = "enc"
                    Return "text/plain"
                Case Is = "mp3"
                    Return "audio/mpeg"
                Case Is = "wav"
                    Return "audio/wav"
                Case Else
                    Return "application/unknown"
            End Select
        End Function

        Public Function URLDecode(ByVal StringToDecode As String) As String
            Dim TempAns As String = ""
            Dim CurChr As Integer
            CurChr = 1
            Do Until CurChr - 1 = Len(StringToDecode)
                Select Case Mid(StringToDecode, CurChr, 1)
                    Case "+"
                        TempAns = TempAns & " "
                    Case "%"
                        TempAns = TempAns & Chr(CInt(Val("&h" & Mid(StringToDecode, CurChr + 1, 2))))
                        CurChr = CurChr + 2
                    Case Else
                        TempAns = TempAns & Mid(StringToDecode, CurChr, 1)
                End Select

                CurChr = CurChr + 1
            Loop

            URLDecode = TempAns
        End Function

        Shared Function ParseQueryString(ByVal url As String) As System.Collections.Specialized.NameValueCollection
            Dim queryStringBegin As Integer = url.IndexOf("?")
            Dim queryString As String = url.Substring(queryStringBegin + 1)
            Dim nvc As System.Collections.Specialized.NameValueCollection = New System.Collections.Specialized.NameValueCollection
            Dim sections() As String = queryString.Split(CChar("&"))
            For Each section As String In sections
                Dim pair() As String = section.Split(CChar("="))
                nvc.Add(pair(0).ToString, pair(1).ToString)
            Next
            Return nvc
        End Function

        Public Sub HandleConnection()
            Dim iStartPos As Integer = 0
            Dim sRequest, sRequestedFile, sErrorMessage As String

            Dim sPhysicalFilePath As String = ""
            Dim bReceive As Byte()
            ReDim bReceive(1024)

            'Receive the request into a byte array
            Dim i As Integer = mySocket.Receive(bReceive, bReceive.Length, 0)

            ' Convert the byte array to a string
            Dim sbuffer As String = Encoding.ASCII.GetString(bReceive)

            RaiseEvent DataReceived(sbuffer)

            iStartPos = sbuffer.IndexOf("HTTP", 1)

            ' Get the HTTP text and version e.g. it will return "HTTP/1.1"
            Dim sHttpVersion As String = sbuffer.Substring(iStartPos, 8)

            ' the web server only accepts get requests.
            If Mid(LCase(sbuffer), 1, 3) <> "get" Then
                ' if not GET request then close socket and exit
                mySocket.Close()
                Return
            End If

            ' Extract path and filename from request
            sRequest = sbuffer.Substring(0, iStartPos - 1)
            sRequest.Replace("\\", "/")

            iStartPos = sRequest.IndexOf("/") + 1

            ' Get the filename
            sRequestedFile = sRequest.Substring(iStartPos)

            ' Check for device ID HTTP request
            If (sRequest.Contains("?uid=")) Then
                Dim theID As String = sRequest.Substring(sRequest.IndexOf("?uid=") + 5)
                RaiseEvent DeviceIDDetected(theID)
                ' Send HTTP header
                SendHeader(sHttpVersion, "text/html", 0, " 200 OK")
                mySocket.Close()
                Return
            End If

            If sRequestedFile.StartsWith("?getartistart") Then
                Dim artistName As String = URLDecode(sRequestedFile.Substring(14))
                Dim artistItems As MediaCenter.IMJFilesAutomation = GlobalHelpers.mediaCenterRef.Search("~sort=[Date (year)]-d [artist]=""" & artistName & """ -[image file]=[] ~nodup=[artist]")
                If artistItems.GetNumberFiles > 0 Then
                    sPhysicalFilePath = artistItems.GetFile(0).GetImageFile(MediaCenter.MJImageFileFlags.IMAGEFILE_DISPLAY)
                End If
            ElseIf sRequestedFile.StartsWith("?getalbumart") Then
                Dim albumName As String = URLDecode(sRequestedFile.Substring(13))
                If albumName = Nothing Then
                    sErrorMessage = "<H2>404 Error! No album name given...</H2>"
                    SendHeader(sHttpVersion, "", sErrorMessage.Length, " 404 Not Found")
                    SendToBrowser(sErrorMessage)
                    Exit Sub
                End If
                Dim albumItems As MediaCenter.IMJFilesAutomation = GlobalHelpers.mediaCenterRef.Search("~sort=[Track #] [album]=""" & albumName & """ -[image file]=[] ~nodup=[album]")
                If albumItems.GetNumberFiles > 0 Then
                    sPhysicalFilePath = albumItems.GetFile(0).GetImageFile(MediaCenter.MJImageFileFlags.IMAGEFILE_THUMBNAIL_MEDIUM)
                End If
            End If

            ' Get the relative path
            'sDirName = sRequest.Substring(sRequest.IndexOf("/"), sRequest.LastIndexOf("/") - 3)

            '' Web server root path
            'sLocalDir = sMyWebServerRoot

            '' if no filename specified
            '' look for default file
            'If (sRequestedFile.Length = 0) Then
            '    sRequestedFile = _DefaultPage
            '    sPhysicalFilePath = sLocalDir & sDirName & sRequestedFile

            '    ' if no default file and no directory requested
            '    ' then show welcome page
            '    If Not File.Exists(sPhysicalFilePath) AndAlso (sDirName = "" OrElse sDirName = "/") Then
            '        sErrorMessage = "<H2>Welcome to the CommandFusion guiDesigner Upload Service<BR>"
            '        sErrorMessage = sErrorMessage & "<BR>No project was loaded.</H2>"
            '        SendHeader(sHttpVersion, "", sErrorMessage.Length, " 404 Not Found")
            '        SendToBrowser(sErrorMessage)
            '        mySocket.Close()
            '        Return
            '    End If
            'End If

            ' get the mime type for the requested file
            Dim sMimeType As String = GetMimeType(sRequestedFile)
            If sMimeType = "" Then
                ' unknown type
                mySocket.Close()
                Return
            End If
            ' Build the complete path to the files
            'sPhysicalFilePath = sLocalDir & sDirName & sRequestedFile
            ' Log("Request for file: " & sPhysicalFilePath)
            If Not File.Exists(sPhysicalFilePath) Then
                ' File does not exist
                sErrorMessage = "<H2>404 Error! File Does Not Exist...</H2>"
                SendHeader(sHttpVersion, "", sErrorMessage.Length, " 404 Not Found")
                SendToBrowser(sErrorMessage)
            Else
                ' Create File Stream of filename
                Dim fs As FileStream = New FileStream(sPhysicalFilePath, FileMode.Open, FileAccess.Read, FileShare.Read)
                ' create reader
                Dim reader As BinaryReader = New BinaryReader(fs)

                ' Read file into byte array
                Dim bytes As Byte() = reader.ReadBytes(CInt(fs.Length))

                ' Total length of file
                Dim totbytes As Integer = CInt(fs.Length)

                ' close the reader and file stream
                reader.Close()
                fs.Close()

                ' Send HTTP header
                SendHeader(sHttpVersion, sMimeType, totbytes, " 200 OK")

                ' Send File
                SendToBrowser(bytes)
            End If

            ' All done for this connection!
            mySocket.Close()

        End Sub

        Private Sub SendHeader(ByVal sHttpVersion As String, ByVal sMIMEHeader As String, ByVal iTotBytes As Integer, ByVal sStatusCode As String)

            Dim sBuffer As String = ""

            ' if Mime type is not provided set default to text/html
            If (sMIMEHeader.Length = 0) Then sMIMEHeader = "text/html" ' // Default Mime Type is text/html

            sBuffer = sBuffer & sHttpVersion & sStatusCode & vbNewLine
            sBuffer = sBuffer & "Server: CommandFusion guiDesigner Upload Service" & vbNewLine
            sBuffer = sBuffer & "Content-Type: " & sMIMEHeader & vbNewLine
            sBuffer = sBuffer & "Accept-Ranges: bytes" & vbNewLine
            sBuffer = sBuffer & "Content-Length: " & iTotBytes & vbNewLine & vbNewLine
            Dim bSendData As Byte() = Encoding.ASCII.GetBytes(sBuffer)
            SendToBrowser(bSendData)

        End Sub

        Private Sub SendToBrowser(ByVal sData As String)
            SendToBrowser(Encoding.ASCII.GetBytes(sData))
        End Sub


        Private Sub SendToBrowser(ByVal bSendData As Byte())
            If (mySocket.Connected) Then
                mySocket.Send(bSendData, bSendData.Length, 0)
            End If
        End Sub
    End Class