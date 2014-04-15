#!/bin/sh

sh convert.sh 2&>1 > /dev/null &

node movies.js