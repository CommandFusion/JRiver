Public NotInheritable Class Audio

    Public Shared Function GetCurrentFile() As MediaCenter.IMJFileAutomation
        Return GlobalHelpers.mediaCenterRef.GetZones.GetZone(GlobalHelpers.mediaCenterRef.GetZones.GetActiveZone).GetPlayingFile
    End Function

    Public Shared Function GetArtists(Optional ByVal PerRow As Integer = 1) As String
        ' Start list data
        Dim list As String = "\xF3RLISTARTISTS\xF4start|"

        Try
            Dim files As MediaCenter.IMJFilesAutomation
            files = GlobalHelpers.mediaCenterRef.Search("[Media Type]=[Audio] -[album]=[] ~nodup=[artist] ~sort=[artist]") ' Get a list of all artists
            list &= files.GetNumberFiles & "|" & PerRow & "\xF5\xF5"

            'MsgBox(Math.Ceiling((files.GetNumberFiles / PerRow) - 1))
            Dim oldLetter As String = ""
            For i As Integer = 0 To files.GetNumberFiles - 1 Step PerRow
                ' Add each list item
                list &= "\xF3RLISTARTISTS\xF4"
                For j As Integer = 0 To PerRow - 1
                    If files.GetNumberFiles > (i + j) Then
                        ' Ensure all pipes are replaced with a colon incase an artist name contains the pipe separator used in our protocol
                        Dim theArtist As String = files.GetFile(i + j).Artist.Replace("|", ":")
                        Dim newLetter As Char = theArtist.Substring(0, 1).ToUpper
                        If Not Char.IsLetter(newLetter) Then
                            newLetter = "#"
                        End If
                        If newLetter <> oldLetter And newLetter <> "" Then
                            list &= "title|" & newLetter & "\xF5\xF5\xF3RLISTARTISTS\xF4"
                            oldLetter = newLetter
                        End If
                        ' If the artist isnt blank
                        If theArtist <> "" Then
                            ' Get Album count
                            Dim albumFiles As MediaCenter.IMJFilesAutomation
                            ' Get a list of all albums
                            albumFiles = GlobalHelpers.mediaCenterRef.Search("[Media Type]=[Audio] [artist]=""" & files.GetFile(i + j).Artist & """ ~nodup=[album]")
                            list &= "item|" & i + j & "|" & theArtist & "|" & albumFiles.GetNumberFiles & "|"
                        End If
                    End If
                Next
                list = list.Substring(0, list.Length - 1)
                list &= "\xF5\xF5"
            Next
            ' End list data
            list &= "\xF3RLISTARTISTS\xF4end\xF5\xF5"

        Catch ex As Exception
            MsgBox(ex.ToString)
        End Try
        Return list
    End Function

    Public Shared Function GetAlbums(ByVal Artist As String, Optional ByVal PerRow As Integer = 1) As String
        ' Start list data
        Dim list As String = "\xF3RLISTALBUMS\xF4start|"

        Try
            Dim files As MediaCenter.IMJFilesAutomation
            files = GlobalHelpers.mediaCenterRef.Search("[Media Type]=[Audio] [artist]=[" & Artist & "] ~nodup=[album] ~sort=[album]") ' Get a list of all artists
            list &= files.GetNumberFiles & "|" & Artist & "|" & PerRow & "\xF5\xF5"

            'MsgBox(files.GetNumberFiles)

            For i As Integer = 0 To files.GetNumberFiles - 1 Step PerRow
                ' Add each list item
                list &= "\xF3RLISTALBUMS\xF4"
                For j As Integer = 0 To PerRow - 1
                    If files.GetNumberFiles > (i + j) Then
                        ' Ensure all pipes are replaced with a colon incase an artist name contains the pipe separator used in our protocol
                        Dim theAlbum As String = files.GetFile(i + j).Album.Replace("|", ":")
                        ' If the album isnt blank
                        If theAlbum <> "" Then
                            ' Get track count
                            Dim trackFiles As MediaCenter.IMJFilesAutomation
                            ' Get a list of all albums
                            trackFiles = GlobalHelpers.mediaCenterRef.Search("~sort=[Date (year)]-d [Media Type]=[Audio] [artist]=[" & Artist & "] [album]=""" & files.GetFile(i + j).Album & """ ~nodup=[name]")
                            Dim theYear As String = files.GetFile(i + j).Year
                            If theYear = 0 Then
                                theYear = ""
                            End If
                            list &= "item|" & i + j & "|" & theAlbum & "|" & trackFiles.GetNumberFiles & "|" & theYear & "|"
                        End If
                    End If
                Next
                list = list.Substring(0, list.Length - 1)
                list &= "\xF5\xF5"
            Next
            ' End list data
            list &= "\xF3RLISTALBUMS\xF4end\xF5\xF5"

        Catch ex As Exception
            MsgBox(ex.ToString)
        End Try
        Return list
    End Function

    Public Shared Function GetTracks(ByVal Artist As String, ByVal Album As String, Optional ByVal PerRow As Integer = 1) As String
        ' Start list data
        Dim list As String = "\xF3RLISTTRACKS\xF4start|"

        Try
            Dim files As MediaCenter.IMJFilesAutomation
            files = GlobalHelpers.mediaCenterRef.Search("[Media Type]=[Audio] [artist]=[" & Artist & "] [album]=[" & Album & "] ~nodup=[name] ~sort=[Track #]") ' Get a list of all artists
            list &= files.GetNumberFiles & "|" & Artist & "|" & Album & "|" & PerRow & "\xF5\xF5"

            'MsgBox(files.GetNumberFiles)

            For i As Integer = 0 To files.GetNumberFiles - 1 Step PerRow
                ' Add each list item
                list &= "\xF3RLISTTRACKS\xF4"
                For j As Integer = 0 To PerRow - 1
                    If files.GetNumberFiles > (i + j) Then
                        ' Ensure all pipes are replaced with a colon incase an artist name contains the pipe separator used in our protocol
                        Dim theTrack As String = files.GetFile(i + j).Name.Replace("|", ":")
                        ' If the track isnt blank
                        If theTrack <> "" Then
                            list &= "item|" & files.GetFile(i + j).Tracknumber & "|" & theTrack & "|" & files.GetFile(i + j).Duration & "|"
                        End If
                    End If
                Next
                list = list.Substring(0, list.Length - 1)
                list &= "\xF5\xF5"
            Next
            ' End list data
            list &= "\xF3RLISTTRACKS\xF4end\xF5\xF5"

        Catch ex As Exception
            MsgBox(ex.ToString)
        End Try
        Return list
    End Function

    Public Shared Sub PlayFile(ByVal Artist As String, Optional ByVal Album As String = "", Optional ByVal Track As Integer = 0)
        If Artist <> "" And Album <> "" And Track <> 0 Then
            ' Play a single track
            Dim files As MediaCenter.IMJFilesAutomation
            files = GlobalHelpers.mediaCenterRef.Search("[Media Type]=[Audio] [artist]=[" & Artist & "] [album]=[" & Album & "] [Track #]=[" & Track & "]") ' Get the track
            If files.GetNumberFiles > 0 Then
                GlobalHelpers.mediaCenterRef.GetCurPlaylist.AddFileByKey(files.GetFile(0).GetKey, GlobalHelpers.mediaCenterRef.GetCurPlaylist.Position + 1)
                If GlobalHelpers.mediaCenterRef.GetCurPlaylist.Position = -1 Then
                    GlobalHelpers.mediaCenterRef.GetCurPlaylist.Position = 0
                End If
                GlobalHelpers.mediaCenterRef.GetPlayback.Next()
                If GlobalHelpers.mediaCenterRef.GetPlayback.State <> MediaCenter.MJPlaybackStates.PLAYSTATE_PLAYING Then
                    GlobalHelpers.mediaCenterRef.GetPlayback.Play()
                End If
            End If
        ElseIf Artist <> "" And Album <> "" Then
            ' Play a whole album
            Dim files As MediaCenter.IMJFilesAutomation
            files = GlobalHelpers.mediaCenterRef.Search("[Media Type]=[Audio] [artist]=[" & Artist & "] [album]=[" & Album & "] ~sort=[Track #]") ' Get the albums tracks
            If files.GetNumberFiles > 0 Then
                For i As Integer = 0 To files.GetNumberFiles - 1
                    GlobalHelpers.mediaCenterRef.GetCurPlaylist.AddFileByKey(files.GetFile(i).GetKey, GlobalHelpers.mediaCenterRef.GetCurPlaylist.Position + i + 1)
                Next
                If GlobalHelpers.mediaCenterRef.GetCurPlaylist.Position = -1 Then
                    GlobalHelpers.mediaCenterRef.GetCurPlaylist.Position = 0
                End If
                GlobalHelpers.mediaCenterRef.GetPlayback.Next()
                If GlobalHelpers.mediaCenterRef.GetPlayback.State <> MediaCenter.MJPlaybackStates.PLAYSTATE_PLAYING Then
                    GlobalHelpers.mediaCenterRef.GetPlayback.Play()
                End If
            End If
        ElseIf Artist <> "" Then
            ' Play a whole artist
            Dim files As MediaCenter.IMJFilesAutomation
            files = GlobalHelpers.mediaCenterRef.Search("[Media Type]=[Audio] [artist]=[" & Artist & "]") ' Get the artists tracks
            If files.GetNumberFiles > 0 Then
                For i As Integer = 0 To files.GetNumberFiles - 1
                    GlobalHelpers.mediaCenterRef.GetCurPlaylist.AddFileByKey(files.GetFile(i).GetKey, GlobalHelpers.mediaCenterRef.GetCurPlaylist.Position + i + 1)
                Next
                If GlobalHelpers.mediaCenterRef.GetCurPlaylist.Position = -1 Then
                    GlobalHelpers.mediaCenterRef.GetCurPlaylist.Position = 0
                End If
                GlobalHelpers.mediaCenterRef.GetPlayback.Next()
                If GlobalHelpers.mediaCenterRef.GetPlayback.State <> MediaCenter.MJPlaybackStates.PLAYSTATE_PLAYING Then
                    GlobalHelpers.mediaCenterRef.GetPlayback.Play()
                End If
            End If
        End If
    End Sub

    Public Shared Sub PlayFileNext(ByVal Artist As String, Optional ByVal Album As String = "", Optional ByVal Track As Integer = 0)
        If Artist <> "" And Album <> "" And Track <> 0 Then
            ' Play a single track next
            Dim files As MediaCenter.IMJFilesAutomation
            files = GlobalHelpers.mediaCenterRef.Search("[Media Type]=[Audio] [artist]=[" & Artist & "] [album]=[" & Album & "] [Track #]=[" & Track & "]") ' Get the track
            If files.GetNumberFiles > 0 Then
                GlobalHelpers.mediaCenterRef.GetCurPlaylist.AddFileByKey(files.GetFile(0).GetKey, GlobalHelpers.mediaCenterRef.GetCurPlaylist.Position + 1)
            End If
        ElseIf Artist <> "" And Album <> "" Then
            ' Play a whole album next
            Dim files As MediaCenter.IMJFilesAutomation
            files = GlobalHelpers.mediaCenterRef.Search("[Media Type]=[Audio] [artist]=[" & Artist & "] [album]=[" & Album & "] ~sort=[Track #]") ' Get the albums tracks
            If files.GetNumberFiles > 0 Then
                For i As Integer = 0 To files.GetNumberFiles - 1
                    GlobalHelpers.mediaCenterRef.GetCurPlaylist.AddFileByKey(files.GetFile(i).GetKey, GlobalHelpers.mediaCenterRef.GetCurPlaylist.Position + i + 1)
                Next
            End If
        ElseIf Artist <> "" Then
            ' Play a whole artist next
            Dim files As MediaCenter.IMJFilesAutomation
            files = GlobalHelpers.mediaCenterRef.Search("[Media Type]=[Audio] [artist]=[" & Artist & "]") ' Get the artists tracks
            If files.GetNumberFiles > 0 Then
                For i As Integer = 0 To files.GetNumberFiles - 1
                    GlobalHelpers.mediaCenterRef.GetCurPlaylist.AddFileByKey(files.GetFile(i).GetKey, GlobalHelpers.mediaCenterRef.GetCurPlaylist.Position + i + 1)
                Next
            End If
        End If
    End Sub

    Public Shared Sub AddFile(ByVal Artist As String, Optional ByVal Album As String = "", Optional ByVal Track As Integer = 0)
        If Artist <> "" And Album <> "" And Track <> 0 Then
            ' Add a single track
            Dim files As MediaCenter.IMJFilesAutomation
            files = GlobalHelpers.mediaCenterRef.Search("[Media Type]=[Audio] [artist]=[" & Artist & "] [album]=[" & Album & "] [Track #]=[" & Track & "]") ' Get the track
            If files.GetNumberFiles > 0 Then
                GlobalHelpers.mediaCenterRef.GetCurPlaylist.AddFileByKey(files.GetFile(0).GetKey, -1)
            End If
        ElseIf Artist <> "" And Album <> "" Then
            ' Add a whole album
            Dim files As MediaCenter.IMJFilesAutomation
            files = GlobalHelpers.mediaCenterRef.Search("[Media Type]=[Audio] [artist]=[" & Artist & "] [album]=[" & Album & "] ~sort=[Track #]") ' Get the albums tracks
            If files.GetNumberFiles > 0 Then
                For i As Integer = 0 To files.GetNumberFiles - 1
                    GlobalHelpers.mediaCenterRef.GetCurPlaylist.AddFileByKey(files.GetFile(i).GetKey, -1)
                Next
            End If
        ElseIf Artist <> "" Then
            ' Add a whole artist
            Dim files As MediaCenter.IMJFilesAutomation
            files = GlobalHelpers.mediaCenterRef.Search("[Media Type]=[Audio] [artist]=[" & Artist & "]") ' Get the artists tracks
            If files.GetNumberFiles > 0 Then
                For i As Integer = 0 To files.GetNumberFiles - 1
                    GlobalHelpers.mediaCenterRef.GetCurPlaylist.AddFileByKey(files.GetFile(i).GetKey, -1)
                Next
            End If
        End If
    End Sub

#Region " ZONES "
    Public Shared Function GetZones(Optional ByVal PerRow As Integer = 1) As String
        ' Start list data
        Dim list As String = "\xF3RLISTZONES\xF4start|"

        Try
            Dim allZones As MediaCenter.IMJZonesAutomation = GlobalHelpers.mediaCenterRef.GetZones
            list &= allZones.GetNumberZones & "|" & PerRow & "\xF5\xF5"

            For i As Integer = 0 To allZones.GetNumberZones - 1 Step PerRow
                ' Add each list item
                list &= "\xF3RLISTZONES\xF4"
                For j As Integer = 0 To PerRow - 1
                    If allZones.GetNumberZones > (i + j) Then
                        ' Ensure all pipes are replaced with a colon incase zone name contains the pipe separator used in our protocol
                        Dim theZone As MediaCenter.IMJZoneAutomation = allZones.GetZone(i + j)
                        ' Bug in the SDK means we have to request the zone name manually
                        Dim theZoneName As String = allZones.GetZoneName(i + j)
                        ' If the zone name isnt blank
                        If theZoneName <> "" Then
                            ' zonename|state|position|duration|artist|album|trackname|tracknum
                            If theZone.GetPlayingFile IsNot Nothing Then
                                list &= "zone|" & i + j & "|" & theZoneName.Replace("|", ":") & "|" & theZone.GetPlayback.State & "|" & theZone.GetPlayback.Position & "|" & theZone.GetPlayingFile.Duration & "|" & theZone.GetPlayingFile.Artist.Replace("|", ":") & "|" & theZone.GetPlayingFile.Album.Replace("|", ":") & "|" & theZone.GetPlayingFile.Name.Replace("|", ":") & "|" & theZone.GetPlayingFile.Tracknumber & "|"
                            Else
                                list &= "zone|" & i + j & "|" & theZoneName.Replace("|", ":") & "|" & theZone.GetPlayback.State & "|||||||"
                            End If
                        End If
                    End If
                Next
                list = list.Substring(0, list.Length - 1)
                list &= "\xF5\xF5"
            Next
            ' End list data
            list &= "\xF3RLISTZONES\xF4end\xF5\xF5"

        Catch ex As Exception
            MsgBox(ex.ToString)
        End Try
        Return list
    End Function

    Public Shared Function GetActiveZone() As String
        ' Start list data
        Dim response As String = "\xF3RACTIVEZONE\xF4"

        Try
            ' Bug in the SDK means we have to request the zone name manually
            response &= GlobalHelpers.mediaCenterRef.GetZones.GetZoneName(GlobalHelpers.mediaCenterRef.GetZones.GetActiveZone)
            response &= "|" & GlobalHelpers.mediaCenterRef.GetZones.GetActiveZone
            response &= "\xF5\xF5"

        Catch ex As Exception
            MsgBox(ex.ToString)
        End Try
        Return response
    End Function

    Public Shared Sub SetActiveZone(ByVal zoneNum As Integer)
        GlobalHelpers.mediaCenterRef.GetZones.SetActiveZone(zoneNum)
    End Sub

    Public Shared Function NowPlaying(ByVal theZoneID As Integer) As String
        Dim response As String = ""
        Try
            ' Get the zone object
            Dim theZone As MediaCenter.IMJZoneAutomation = GlobalHelpers.mediaCenterRef.GetZones.GetZone(theZoneID)

            ' Start the response by giving the zone ID and name
            response = "\xF3RNOWPLAYING\xF4" & theZoneID & "|" & _
            GlobalHelpers.mediaCenterRef.GetZones.GetZoneName(theZoneID).Replace("|", ":") & "|"

            ' Now add the currently playing track info
            ' state|position|duration|artist|album|trackname|tracknum
            If theZone.GetPlayingFile IsNot Nothing Then
                response &= theZone.GetPlayback.State & "|" & theZone.GetPlayback.Position & "|" & theZone.GetPlayingFile.Duration & "|" & _
                theZone.GetPlayingFile.Artist & "|" & theZone.GetPlayingFile.Album & "|" & theZone.GetPlayingFile.Name & "|" & theZone.GetPlayingFile.Tracknumber & "|" & theZone.GetCurPlaylist.Position
            Else
                response &= theZone.GetPlayback.State & "|0|0||||"
            End If

            response &= "\xF5\xF5"
        Catch ex As Exception
            MsgBox(ex.ToString)
        End Try
        Return response
    End Function

    Public Shared Function GetPlaylist(ByVal Zone As Integer, Optional ByVal PerRow As Integer = 1) As String
        ' Start list data
        Dim list As String = "\xF3RLISTZONEPLAYLIST\xF4start|"

        Try

            Dim files As MediaCenter.IMJCurPlaylistAutomation = GlobalHelpers.mediaCenterRef.GetZones.GetZone(Zone).GetCurPlaylist()
            list &= files.GetNumberFiles & "|" & Zone & "|" & PerRow & "\xF5\xF5"

            For i As Integer = 0 To files.GetNumberFiles - 1 Step PerRow
                ' Add each list item
                list &= "\xF3RLISTZONEPLAYLIST\xF4"
                For j As Integer = 0 To PerRow - 1
                    If files.GetNumberFiles > (i + j) Then
                        ' Ensure all pipes are replaced with a colon incase an artist name contains the pipe separator used in our protocol
                        Dim theTrack As MediaCenter.IMJFileAutomation = files.GetFile(i + j)
                        Dim theTrackName As String = theTrack.Name.Replace("|", ":")
                        ' If the track isnt blank
                        If theTrackName <> "" Then
                            ' playlistPosition|duration|artist|album|trackname|tracknum
                            list &= "item|" & i + j + 1 & "|" & theTrack.Duration & "|" & theTrack.Artist.Replace("|", ":") & "|" & theTrack.Album.Replace("|", ":") & "|" & theTrack.Name.Replace("|", ":") & "|" & theTrack.Tracknumber
                        Else
                            list &= "item||||||"
                        End If
                    End If
                Next
                list = list.Substring(0, list.Length - 1)
                list &= "\xF5\xF5"
            Next
            ' End list data
            list &= "\xF3RLISTZONEPLAYLIST\xF4end\xF5\xF5"

        Catch ex As Exception
            MsgBox(ex.ToString)
        End Try
        Return list
    End Function
#End Region
End Class