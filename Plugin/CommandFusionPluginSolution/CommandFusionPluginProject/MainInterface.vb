Imports System.Runtime.InteropServices
Imports System.Text.RegularExpressions

    'The interop services allow the plugin to be registered with a CLSID so Media Center can find it
    'The Prog ID must match with that in the registry in order for MC to be able to pick up the plugin
<System.Runtime.InteropServices.ProgId("MCPlugin.CommandFusion")> _
Public Class MainInterface

    Private WithEvents tcp As New TCPComms
    Private WithEvents webServ As Webserver
    Private EOM As String = Chr(245) & Chr(245)

    Private port As Integer

#Region "Media Center Initialisation & Termination"
    ' <summary>
    ' After the plugin has been created Media Center 
    ' will call the following method, giving us a reference
    ' to the Media Center interface.
    ' </summary>
    ' <param name="mediaCenterReference">
    ' Media Center Reference
    ' </param>        
    Public Sub init(ByVal mediaCenterRef As MediaCenter.IMJAutomation)
        Try
            GlobalHelpers.Log("Initializing", False)
            GlobalHelpers.mediaCenterRef = mediaCenterRef
            port = My.Settings.Port
            tcp.Port = port
            tcp.Init()
            GlobalHelpers.Log("Started TCP listening on port " & port.ToString)

            webServ = New Webserver(port + 1)
            webServ.StartServer()
            GlobalHelpers.Log("Started Web Server listening on port " & webServ.Port.ToString)
        Catch ex As Exception
            MsgBox(ex.ToString)
        End Try
    End Sub

    Public Sub Terminate()
        GlobalHelpers.Log("Terminating")
        Try
            tcp.Close()
            GlobalHelpers.Log("Stopped TCP listening")
        Catch ex As Exception
        End Try
        Try
            webServ.StopServer()
            GlobalHelpers.Log("Stopped web server")
        Catch ex As Exception
        End Try
    End Sub
#End Region

    Public Overridable Sub DataReceived(ByVal connID As Long, ByVal remoteIP As String, ByVal data As Byte()) Handles tcp.DataReceived
        Dim msg As String = GlobalHelpers.GenerateReadable(data)
        'MsgBox(msg)
        Dim bytes As String = System.Text.Encoding.GetEncoding(1252).GetString(data)
        'Dim msgs As String() = System.Text.RegularExpressions.Regex.Split(msg, "(" & System.Text.RegularExpressions.Regex.Escape(Me.EOM) & ")")
        Dim msgs As String() = bytes.Split(New String() {Me.EOM}, StringSplitOptions.RemoveEmptyEntries)
        Dim regexp As New Regex("\xF3(\w+)\xF4(.*)\xF5\xF5", RegexOptions.Compiled)
        For Each aMsg As String In msgs
            aMsg &= Chr(245) & Chr(245)
            ' Ensure data is in correct format
            If Not regexp.IsMatch(aMsg) Then
                ' incoming data in incorrect format
                GlobalHelpers.Log("Received Incorrectly Formatted Message [" & remoteIP & "]: " & aMsg)
                Continue For
            End If

            Dim matchGroups As GroupCollection = regexp.Match(aMsg).Groups
            ' What did the client request?
            Select Case matchGroups(1).Value
                Case "TNAV" ' Navigation button request sent
                    ' Get the action
                    Select Case matchGroups(2).Value.ToLower
                        Case "stop"
                            GlobalHelpers.mediaCenterRef.GetPlayback.Stop()
                        Case "record"
                        Case "playpause"
                            If GlobalHelpers.mediaCenterRef.GetPlayback.State = MediaCenter.MJPlaybackStates.PLAYSTATE_PLAYING Or GlobalHelpers.mediaCenterRef.GetPlayback.State = MediaCenter.MJPlaybackStates.PLAYSTATE_PAUSED Then
                                GlobalHelpers.mediaCenterRef.GetPlayback.Pause()
                            ElseIf GlobalHelpers.mediaCenterRef.GetCurPlaylist.GetNumberFiles <> 0 Then
                                If GlobalHelpers.mediaCenterRef.GetCurPlaylist.GetNumberFiles > 0 Then
                                    If GlobalHelpers.mediaCenterRef.GetCurPlaylist.Position < 0 Then
                                        GlobalHelpers.mediaCenterRef.GetCurPlaylist.Position = 0
                                    End If
                                    GlobalHelpers.mediaCenterRef.GetPlayback.Play()
                                End If
                            End If
                        Case "pause"
                            GlobalHelpers.mediaCenterRef.GetPlayback.Pause()
                        Case "play"
                            GlobalHelpers.mediaCenterRef.GetPlayback.Play()
                        Case "rewind"
                            GlobalHelpers.mediaCenterRef.GetPlayback.Rewind()
                        Case "forward"
                            GlobalHelpers.mediaCenterRef.GetPlayback.FastForward()
                        Case "replay"
                        Case "next"
                            GlobalHelpers.mediaCenterRef.GetPlayback.Next()
                        Case "prev"
                            GlobalHelpers.mediaCenterRef.GetPlayback.Previous()
                        Case "info"
                        Case "volup"
                            GlobalHelpers.mediaCenterRef.GetMJMixer.Volume += 1
                        Case "voldown"
                            GlobalHelpers.mediaCenterRef.GetMJMixer.Volume -= 1
                        Case "volmute"
                            GlobalHelpers.mediaCenterRef.GetMJMixer.Mute = Not GlobalHelpers.mediaCenterRef.GetMJMixer.Mute
                        Case "0"
                        Case "1"
                        Case "2"
                        Case "3"
                        Case "4"
                        Case "5"
                        Case "6"
                        Case "7"
                        Case "8"
                        Case "9"
                        Case "*"
                        Case "#"
                        Case "clear"
                        Case "enter"
                    End Select

                    System.Threading.Thread.Sleep(100)
                    GlobalHelpers.Log("Pressed button " & matchGroups(2).Value.ToLower)

                Case "TGETLIST" ' Status request sent
                    Dim params() As String = matchGroups(2).Value.Split("|")
                    Dim response As String = ""
                    Select Case params(0)
                        Case "allartists"
                            ' check for limit params
                            If params.Length = 2 Then
                                If Not IsNumeric(params(1)) Then
                                    GlobalHelpers.Log("Non-numeric parameters received in call '" & params(1) & "'")
                                Else
                                    ' Get list of artists, in blocks of params(1)
                                    response = Audio.GetArtists(params(1))
                                End If
                            Else
                                ' Get list of artists, one at a time
                                response = Audio.GetArtists()
                            End If
                        Case "albums"
                            ' check for limit params
                            If params.Length = 3 Then
                                If Not IsNumeric(params(2)) Then
                                    GlobalHelpers.Log("Non-numeric parameters received in call '" & params(2) & "'")
                                Else
                                    ' Get list of albums, in blocks of params(1)
                                    response = Audio.GetAlbums(params(1), params(2))
                                End If
                            Else
                                ' Get list of albums, one at a time
                                response = Audio.GetAlbums(params(1))
                            End If
                        Case "tracks"
                            ' check for limit params
                            If params.Length = 4 Then
                                If Not IsNumeric(params(3)) Then
                                    GlobalHelpers.Log("Non-numeric parameters received in call '" & params(3) & "'")
                                Else
                                    ' Get list of tracks, in blocks of params(1)
                                    response = Audio.GetTracks(params(1), params(2), params(3))
                                End If
                            Else
                                ' Get list of tracks, one at a time
                                response = Audio.GetTracks(params(1), params(2))
                            End If
                        Case "zones"
                            ' check for limit params
                            If params.Length = 2 Then
                                If Not IsNumeric(params(1)) Then
                                    GlobalHelpers.Log("Non-numeric parameters received in call '" & params(1) & "'")
                                Else
                                    ' Get list of zones, in blocks of params(1)
                                    response = Audio.GetZones(params(1))
                                End If
                            Else
                                ' Get list of zones, one at a time
                                response = Audio.GetZones()
                            End If
                        Case "zoneplaylist"
                            ' check for limit params
                            If params.Length = 3 Then
                                If Not IsNumeric(params(2)) Then
                                    GlobalHelpers.Log("Non-numeric parameters received in call '" & params(2) & "'")
                                Else
                                    ' Get list of now playing for zone, in blocks of params(2)
                                    response = Audio.GetPlaylist(params(1), params(2))
                                End If
                            ElseIf params.Length = 2 Then
                                ' Get list of tracks for given zone, one at a time
                                response = Audio.GetPlaylist(params(1))
                            Else
                                ' Get list of tracks in current zone, one at a time
                                response = Audio.GetPlaylist(GlobalHelpers.mediaCenterRef.GetZones.GetActiveZone)
                            End If
                    End Select
                    If response <> "" Then
                        'GlobalHelpers.SetClipboardText(response)
                        tcp.SendMsg(response, connID)
                    End If
                Case "TPLAY" ' Request to play a media item
                    Dim params() As String = matchGroups(2).Value.Split("|")
                    Dim response As String = ""
                    Select Case params(0)
                        Case "track"
                            If params.Length >= 4 Then
                                Audio.PlayFile(params(1), params(2), params(3))
                            Else
                                GlobalHelpers.Log("Not enough params received to play a track.")
                            End If
                        Case "album"
                            If params.Length = 3 Then
                                Audio.PlayFile(params(1), params(2))
                            Else
                                GlobalHelpers.Log("Not enough params received to play an album.")
                            End If
                        Case "artist"
                            If params.Length = 2 Then
                                Audio.PlayFile(params(1))
                            Else
                                GlobalHelpers.Log("Not enough params received to play an artist.")
                            End If
                    End Select
                    response = Audio.GetPlaylist(GlobalHelpers.mediaCenterRef.GetZones.GetActiveZone)
                    If response <> "" Then
                        tcp.SendMsg(response)
                    End If
                Case "TPLAYNEXT" ' Request to play a media item
                    Dim params() As String = matchGroups(2).Value.Split("|")
                    Dim response As String = ""
                    Select Case params(0)
                        Case "track"
                            If params.Length >= 4 Then
                                Audio.PlayFileNext(params(1), params(2), params(3))
                            Else
                                GlobalHelpers.Log("Not enough params received to playnext a track.")
                            End If
                        Case "album"
                            If params.Length = 3 Then
                                Audio.PlayFileNext(params(1), params(2))
                            Else
                                GlobalHelpers.Log("Not enough params received to playnext an album.")
                            End If
                        Case "artist"
                            If params.Length = 2 Then
                                Audio.PlayFileNext(params(1))
                            Else
                                GlobalHelpers.Log("Not enough params received to playnext an artist.")
                            End If
                    End Select
                    response = Audio.GetPlaylist(GlobalHelpers.mediaCenterRef.GetZones.GetActiveZone)
                    If response <> "" Then
                        tcp.SendMsg(response)
                    End If
                Case "TADD" ' Request to enqueue a media item
                    Dim params() As String = matchGroups(2).Value.Split("|")
                    Dim response As String = ""
                    Select Case params(0)
                        Case "track"
                            If params.Length >= 4 Then
                                Audio.AddFile(params(1), params(2), params(3))
                            Else
                                GlobalHelpers.Log("Not enough params received to enqueue a track.")
                            End If
                        Case "album"
                            If params.Length = 3 Then
                                Audio.AddFile(params(1), params(2))
                            Else
                                GlobalHelpers.Log("Not enough params received to enqueue an album.")
                            End If
                        Case "artist"
                            If params.Length = 2 Then
                                Audio.AddFile(params(1))
                            Else
                                GlobalHelpers.Log("Not enough params received to enqueue an artist.")
                            End If
                    End Select
                    response = Audio.GetPlaylist(GlobalHelpers.mediaCenterRef.GetZones.GetActiveZone)
                    If response <> "" Then
                        tcp.SendMsg(response)
                    End If
                Case "TGETZONE" ' Request the active zone name
                    Dim params() As String = matchGroups(2).Value.Split("|")
                    Dim response As String = ""
                    response = Audio.GetActiveZone()
                    If response <> "" Then
                        'GlobalHelpers.SetClipboardText(response)
                        tcp.SendMsg(response)
                    End If
                Case "TSETZONE" ' Set the active zone
                    Dim params() As String = matchGroups(2).Value.Split("|")
                    Dim response As String = ""
                    If params.Length = 1 Then
                        If Not IsNumeric(params(0)) Then
                            GlobalHelpers.Log("Non-numeric parameters received in call '" & params(0) & "'")
                        Else
                            ' Set the active zone by number
                            Audio.SetActiveZone(params(0))
                            response = Audio.GetActiveZone() & "\xF3RPLAYSTATE\xF4" & GlobalHelpers.mediaCenterRef.GetPlayback.State & "\xF5\xF5"
                        End If
                    End If
                    If response <> "" Then
                        'GlobalHelpers.SetClipboardText(response)
                        tcp.SendMsg(response)
                    End If
                Case "TNOWPLAYING" ' Request the now playing data
                    Dim params() As String = matchGroups(2).Value.Split("|")
                    Dim response As String = ""
                    response = Audio.NowPlaying(GlobalHelpers.mediaCenterRef.GetZones.GetActiveZone)
                    If response <> "" Then
                        'GlobalHelpers.SetClipboardText(response)
                        tcp.SendMsg(response)
                    End If
                Case "TVOL" ' Set the volume level precisely
                    Dim response As String = ""
                    GlobalHelpers.mediaCenterRef.GetMJMixer.Volume = matchGroups(2).Value
                Case "TVOLGET" ' Return the volume level
                    tcp.SendMsg("\xF3RVOL\xF4" & GlobalHelpers.mediaCenterRef.GetMJMixer.Volume & "\xF5\xF5")
                Case "TCLEAR" ' Clear the playlist for current zone
                    GlobalHelpers.mediaCenterRef.GetCurPlaylist.RemoveAllFiles()
                Case "TCLEARZONE" ' Clear the playlist for a specific zone
                    Dim param As String = matchGroups(2).Value
                    If IsNumeric(param) Then
                        GlobalHelpers.mediaCenterRef.GetZones.GetZone(param).GetCurPlaylist.RemoveAllFiles()
                    End If
                Case "TITEMDELETE" ' Delete an item from the current zones playlist
                    GlobalHelpers.mediaCenterRef.GetCurPlaylist.RemoveFile(matchGroups(2).Value)
                Case "TITEMPLAY" ' Plays an item in the current zones playlist
                    GlobalHelpers.mediaCenterRef.GetCurPlaylist.Position = matchGroups(2).Value
                    GlobalHelpers.mediaCenterRef.GetPlayback.Play()
                Case "TITEMPLAYNEXT" ' Plays an item next in the current zones playlist
                    'TODO - Change logic to jump to the specific track after current playback finishes rather than moving the item in the list
                    Dim nextIndex As Integer = GlobalHelpers.mediaCenterRef.GetCurPlaylist.GetNextFile
                    GlobalHelpers.mediaCenterRef.GetCurPlaylist.MoveFile(matchGroups(2).Value, nextIndex)
                Case "TSCRUB" ' Scrub track position
                    GlobalHelpers.mediaCenterRef.GetPlayback.Position = (Audio.GetCurrentFile.Duration / 65535) * matchGroups(2).Value
            End Select
        Next
        GlobalHelpers.Log("Received [" & remoteIP & "]: " & msg)
    End Sub

    Private Sub numPort_ValueChanged(ByVal sender As System.Object, ByVal e As System.EventArgs) Handles numPort.ValueChanged
        My.Settings.Port = numPort.Value
    End Sub

#Region " EVENT HANDLING "
    Private WithEvents MC As New MediaCenter.MCAutomation
    Private _RelayEvent As RelayEvent
    Delegate Sub RelayEvent(ByVal EventData1 As String, ByVal EventData2 As String, ByVal EventData3 As String)

    Private Sub MyRelayEvent(ByVal EventData1 As String, ByVal EventData2 As String, ByVal EventData3 As String)
        Dim response As String = ""
        Select Case EventData2.Trim
            Case "MCC: NOTIFY_TRACK_CHANGE"
                Dim theZone As String = EventData3
                response = Audio.NowPlaying(theZone)
            Case "MCC: NOTIFY_PLAYERSTATE_CHANGE"
                response = "\xF3RPLAYSTATE\xF4" & GlobalHelpers.mediaCenterRef.GetPlayback.State & "\xF5\xF5"
                ' Start or stop sending track status every second depending on the new playback state
                If GlobalHelpers.mediaCenterRef.GetPlayback.State = MediaCenter.MJPlaybackStates.PLAYSTATE_PLAYING Then
                    ' Only send status every second when actually playing
                    timerStatus.Enabled = True
                    timerStatus.Start()
                Else
                    timerStatus.Enabled = False
                    timerStatus.Stop()
                End If
            Case "MCC: NOTIFY_VOLUME_CHANGED"
                response = "\xF3RVOL\xF4" & GlobalHelpers.mediaCenterRef.GetMJMixer.Volume & "\xF5\xF5"
            Case "MCC: NOTIFY_PLAYLIST_FILES_CHANGED"
                ' This doesnt work for "playing now"
                'response = Audio.GetPlaylist(GlobalHelpers.mediaCenterRef.GetZones.GetActiveZone)
        End Select
        If response <> "" Then
            'GlobalHelpers.SetClipboardText(response)
            tcp.SendMsg(response)
        End If
        Application.DoEvents()
    End Sub

    Private Sub timerStatus_Tick(ByVal sender As System.Object, ByVal e As System.EventArgs) Handles timerStatus.Tick
        ' Send out track status every second
        Dim response As String = ""
        response = Audio.NowPlaying(GlobalHelpers.mediaCenterRef.GetZones.GetActiveZone)
        If response <> "" Then
            'GlobalHelpers.SetClipboardText(response)
            tcp.SendMsg(response)
        End If
    End Sub

    Public Sub MC_FireMJEvent(ByVal s0 As String, ByVal s1 As String, ByVal s2 As String) Handles MC.FireMJEvent
        _RelayEvent = New RelayEvent(AddressOf MyRelayEvent)
        _RelayEvent.Invoke(s0, s1, s2)
    End Sub
#End Region

End Class

    Public NotInheritable Class GlobalHelpers
        'This is the Interface to Media Center
        'This is set when Media Center calls the Init Method  
        Public Shared mediaCenterRef As MediaCenter.IMJAutomation

#Region " Log Code "
        'The Error handlers
        Public Sub MYExceptionHandler(ByVal sender As Object, ByVal e As UnhandledExceptionEventArgs)
            Dim EX As Exception
            EX = e.ExceptionObject
            Log("CRITICAL ERROR: " & EX.ToString)
        End Sub

        Public Sub MYThreadHandler(ByVal sender As Object, ByVal e As Threading.ThreadExceptionEventArgs)
            Log("CRITICAL ERROR: " & e.Exception.ToString)
        End Sub

        Public Shared Sub Log(ByVal msg As String, Optional ByVal Append As Boolean = True)
            If IO.File.Exists(IO.Path.GetDirectoryName(Reflection.Assembly.GetExecutingAssembly.Location()) & "\log.txt") And Append = False Then
                Dim logFile As New IO.FileInfo(IO.Path.GetDirectoryName(Reflection.Assembly.GetExecutingAssembly.Location()) & "\log.txt")
                ' If larger than 3 MB, start new log file
                If logFile.Length < (1024 * 1024 * 3) Then
                    Append = True
                Else
                    ' Create backup of log file
                    IO.File.Copy(IO.Path.GetDirectoryName(Reflection.Assembly.GetExecutingAssembly.Location()) & "\log.txt", "log_" & Now.Day & "-" & Now.Month & "-" & Now.Year & "_" & Now.TimeOfDay.Hours & Now.TimeOfDay.Minutes & ".txt", True)
                End If
            End If
        Try
            Dim writer As New IO.StreamWriter(IO.Path.GetDirectoryName(Reflection.Assembly.GetExecutingAssembly.Location()) & "\log.txt", Append)
            writer.WriteLine("[" & Now() & "] " & msg)
            writer.Close()
        Catch ex As Exception
        End Try

        End Sub
#End Region

        Public Shared Function GenerateReadable(ByVal bytes As Byte()) As String
            Dim tmpMsg As String = System.Text.Encoding.ASCII.GetString(bytes)
            Dim i As Integer = 0
            Dim readable As String = ""
            For Each aByte As Byte In bytes
                If Int32.Parse(aByte) >= 33 And Int32.Parse(aByte) < 127 Then
                    readable &= tmpMsg(i)
                Else
                    readable &= "\x" & Conversion.Hex(aByte).PadLeft(2, "0")
                End If
                'hexonly &= Conversion.Hex(aByte).PadLeft(2, "0")
                i += 1
            Next
            Return readable
        End Function

        Public Shared Function ToAscii(ByVal Data As String) As String
            Return System.Text.Encoding.ASCII.GetString(System.Text.Encoding.Unicode.GetBytes(Data))
        End Function

        Public Shared Function BytesToAscii(ByVal Data As Byte()) As String
            Return System.Text.Encoding.ASCII.GetString(Data)
        End Function

        Public Shared Sub SetClipboardText(ByVal text As String)
        'My.Computer.Clipboard.SetText(text)
        End Sub
    End Class