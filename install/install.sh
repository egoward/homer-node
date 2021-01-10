#!/bin/sh
echo Installing Homer service

SCRIPT=$(dirname "$0")
BASEDIR=$(realpath $SCRIPT/.. )
# BASEDIR_EXPECTED=/mnt/c/ed/PISensor
BASEDIR_EXPECTED=/home/pi/homer-node
SERVICE_FILE=/lib/systemd/system/homer-node.service

echo SCRIPT=$SCRIPT
echo BASEDIR=$BASEDIR

if [ $BASEDIR = $BASEDIR_EXPECTED ]
then
    echo Installing from $BASEDIR
else
    echo ERROR : Unexpected install location:
    echo   Actual install path : $BASEDIR
    echo   Expected install path : $BASEDIR_EXPECTED
    exit 1
fi;

echo Trying to stop service
systemctl stop homer-node.service

if [ -e $SERVICE_FILE ]
then
    echo Removing existing file $SERVICE_FILE
    rm $SERVICE_FILE
else
    echo Files does not exist $SERVICE_FILE
fi;

echo Executing NPM install
(cd $BASEDIR; npm install)

echo Installing file $SERVICE_FILE
cp $BASEDIR/install/homer-node.service $SERVICE_FILE

echo Enabling service
systemctl enable homer-node.service

echo Starting service
systemctl start homer-node.service

