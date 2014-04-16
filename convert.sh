#!/bin/sh

if [ -e convertfifo ]; then
    unlink convertfifo;
fi;

mkfifo convertfifo;

while [ true ]; do

    POLL=`cat convertfifo`;
    IFS='_' read -ra PARAMS <<< "$POLL"

    OPT="${PARAMS[0]}"
    MOVIE=`echo "${PARAMS[1]}" | base64 --decode`

    if [ "$OPT" == "convert" ]; then
       GIF=`echo "${PARAMS[2]}" | base64 --decode`

       mplayer "$MOVIE" -ao null -ss 600 -endpos 5 -vo gif89a:fps=13:output="$GIF" -vf scale=120:90 &

    else    
       SUB=`echo "${PARAMS[2]}" | base64 --decode`
       mplayer "$MOVIE" -fs -vo vaapi -sub "$SUB" &
    fi;

done;
