#!/bin/sh


if [ -e convertfifo ]; then
    unlink convertfifo;
fi;

mkfifo convertfifo;

COUNTER=0

while [ 1 ]; do

    PARAM=`cat convertfifo`;
    
    $PARAM &

    COUNTER=($COUNTER+1);

    if [ "$COUNTER" == "4" ]; then
        COUNTER=0;
        wait; 
    fi;

done;