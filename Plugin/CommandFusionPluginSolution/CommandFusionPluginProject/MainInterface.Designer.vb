
<Global.Microsoft.VisualBasic.CompilerServices.DesignerGenerated()> _
Partial Class MainInterface
    Inherits System.Windows.Forms.UserControl


    'Form overrides dispose to clean up the component list.
    <System.Diagnostics.DebuggerNonUserCode()> _
    Protected Overrides Sub Dispose(ByVal disposing As Boolean)
        If disposing AndAlso components IsNot Nothing Then
            components.Dispose()
        End If
        MyBase.Dispose(disposing)
    End Sub

    'Required by the Windows Form Designer
    Private components As System.ComponentModel.IContainer

    'NOTE: The following procedure is required by the Windows Form Designer
    'It can be modified using the Windows Form Designer.  
    'Do not modify it using the code editor.
    <System.Diagnostics.DebuggerStepThrough()> _
    Private Sub InitializeComponent()
        Me.components = New System.ComponentModel.Container
        Me.lblHome = New System.Windows.Forms.LinkLabel
        Me.lblDesc = New System.Windows.Forms.Label
        Me.numPort = New System.Windows.Forms.NumericUpDown
        Me.lblPort = New System.Windows.Forms.Label
        Me.timerStatus = New System.Windows.Forms.Timer(Me.components)
        CType(Me.numPort, System.ComponentModel.ISupportInitialize).BeginInit()
        Me.SuspendLayout()
        '
        'lblHome
        '
        Me.lblHome.AutoSize = True
        Me.lblHome.Location = New System.Drawing.Point(45, 99)
        Me.lblHome.Name = "lblHome"
        Me.lblHome.Size = New System.Drawing.Size(142, 13)
        Me.lblHome.TabIndex = 11
        Me.lblHome.TabStop = True
        Me.lblHome.Text = "CommandFusion Plugin Help"
        '
        'lblDesc
        '
        Me.lblDesc.Location = New System.Drawing.Point(3, 0)
        Me.lblDesc.Name = "lblDesc"
        Me.lblDesc.Size = New System.Drawing.Size(230, 52)
        Me.lblDesc.TabIndex = 10
        Me.lblDesc.Text = "Here you can adjust the TCP port that the CommandFusion plugin listens on." & Global.Microsoft.VisualBasic.ChrW(13) & Global.Microsoft.VisualBasic.ChrW(10) & "The d" & _
            "efault is 8022." & Global.Microsoft.VisualBasic.ChrW(13) & Global.Microsoft.VisualBasic.ChrW(10) & "The artwork web server will use this port + 1"
        '
        'numPort
        '
        Me.numPort.Location = New System.Drawing.Point(99, 65)
        Me.numPort.Maximum = New Decimal(New Integer() {65535, 0, 0, 0})
        Me.numPort.Minimum = New Decimal(New Integer() {1, 0, 0, 0})
        Me.numPort.Name = "numPort"
        Me.numPort.Size = New System.Drawing.Size(61, 20)
        Me.numPort.TabIndex = 9
        Me.numPort.Value = New Decimal(New Integer() {8022, 0, 0, 0})
        '
        'lblPort
        '
        Me.lblPort.Location = New System.Drawing.Point(3, 67)
        Me.lblPort.Name = "lblPort"
        Me.lblPort.Size = New System.Drawing.Size(90, 13)
        Me.lblPort.TabIndex = 8
        Me.lblPort.Text = "TCP Socket Port:"
        '
        'timerStatus
        '
        Me.timerStatus.Interval = 1000
        '
        'MainInterface
        '
        Me.Controls.Add(Me.lblHome)
        Me.Controls.Add(Me.lblDesc)
        Me.Controls.Add(Me.numPort)
        Me.Controls.Add(Me.lblPort)
        Me.Name = "MainInterface"
        Me.Size = New System.Drawing.Size(236, 128)
        CType(Me.numPort, System.ComponentModel.ISupportInitialize).EndInit()
        Me.ResumeLayout(False)
        Me.PerformLayout()

    End Sub
    Friend WithEvents lblHome As System.Windows.Forms.LinkLabel
    Friend WithEvents lblDesc As System.Windows.Forms.Label
    Friend WithEvents numPort As System.Windows.Forms.NumericUpDown
    Friend WithEvents lblPort As System.Windows.Forms.Label
    Friend WithEvents timerStatus As System.Windows.Forms.Timer

End Class