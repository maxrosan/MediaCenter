#!/bin/sh

killall convert.sh
killall node
killall -9 mplayer

sh convert.sh 2&>1 > /dev/null &

node movies.js
