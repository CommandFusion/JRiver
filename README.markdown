# JRiver Media Center Control

## Contents
* [Overview](#Overview)
* [API Documentation][API]



## <a name="Overview" />Overview
This project allows for control of JRiver Media Center software on Windows&trade; PC's via CommandFusion iViewer.

The project is split into 3 parts:

1. [JRiver Media Center Plugin](#plugin)
1. [iViewer JavaScript file](#js)
1. [CF iViewer Project](#iviewer)

### <a name="plugin" />JRiver Media Center Plugin
We have developed a plugin for JRiver that allows full two-way control via a TCP Socket.
It also includes a web server to serve up art work for album covers, etc.
The plugin has a configuration interface to allow easy configuration:
![Plugin Configuration Window (main window)](https://github.com/CommandFusion/JRiver/raw/master/Screenshots/configwindow.png "Plugin Configuration Window")

[API]: http://github.com/CommandFusion/JRiver/wiki