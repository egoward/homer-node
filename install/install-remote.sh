#!/bin/sh
if [ ! -n "$1" ]
then
    echo "Specify a hostname for install!"
    exit 1
fi

echo Testing installation on $1
SCRIPT=$(dirname "$0")
BASEDIR=$(realpath $SCRIPT/../ )
REMOTE_USER=pi
REMOTE_HOST=$1
REMOTEDIR="/home/pi/"

echo Installing from $BASEDIR to $REMOTE_HOST
# echo "Removing old files in $REMOTEDIR"
# ssh $REMOTE_USER@$REMOTE_HOST rm -vR $REMOTEDIR
echo Copying from $BASEDIR to $REMOTEDIR
rsync -vrt --exclude node_modules -e ssh $BASEDIR $REMOTE_USER@$REMOTE_HOST:$REMOTEDIR

ssh $REMOTE_USER@$REMOTE_HOST sudo $REMOTEDIR/homer-node/install/install.sh


echo To view logs, run...
echo    ssh $REMOTE_USER@$REMOTE_HOST \"tail -f /var/log/daemon.log\"
