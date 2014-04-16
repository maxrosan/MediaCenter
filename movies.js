
var pathToLocateMovies = '/home/max/Vídeos/movies';

var files = require('fs');
var sqlite = require('sqlite3');
var restify = require('restify');
var sys = require('sys');
var exec = require('child_process').exec;
var cproc = require('child_process');
var mime = require('mime');
var execSync = require('exec-sync');

var db = new sqlite.Database('movies.db');

var moviesExtension = ['mkv', 'mp4', 'avi'];
var subtitleExtension = ['srt'];

db.serialize(function() {
    db.run('CREATE TABLE IF NOT EXISTS movies (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT NOT NULL, subtitles TEXT, screenshot TEXT NOT NULL);');
    //db.run('DELETE FROM movies;');
});

function toBase64(value) {
    return (new Buffer(value)).toString('base64');
}

function fromBase64(value) {
    return (new Buffer(value, 'base64')).toString('utf8');
}

function processDirectory(filesMovieDirectory) {

    var subtitles = '';

    console.log('Processing ' + directoryOfMovie);

    for (var j = 0; j < filesMovieDirectory.length; j++) {
        var parts = filesMovieDirectory[j].split('.');
        var extension = parts[parts.length - 1];

        if (subtitleExtension.indexOf(extension) != -1) {

            var completeSubtitlePath = directoryOfMovie + '/' + filesMovieDirectory[j];

            if (subtitles.length > 1) {
                subtitles = subtitles + ';';
            }

            subtitles = subtitles + completeSubtitlePath;
        }
    }

    for (var j = 0; j < filesMovieDirectory.length; j++) {

        var completeMoviePath = directoryOfMovie + '/' + filesMovieDirectory[j];
        var parts = filesMovieDirectory[j].split('.');
        var extension = parts[parts.length - 1];

        if (moviesExtension.indexOf(extension) != -1) {

            console.log('movie = ' + completeMoviePath);

            db.serialize(function() {

                var movie = completeMoviePath;
                var directoryMovieTmp = directoryOfMovie;
                var path64Base = toBase64(movie); 
                var screenshotFile = path64Base + '.gif';

                db.all('SELECT * FROM movies WHERE path = \'' + path64Base + '\'', function(errorSelect, rowsSelect) {
                    if (rowsSelect.length == 0) {
                        var destGifFile = directoryMovieTmp + '/' + screenshotFile;
                        //var command = 'mplayer \\"' + movie + '\\" -ao null -ss 40 -endpos 5 -vo gif89a:fps=13:output=\\"' + destGifFile + '\\" -vf scale=120:90';
			var command = 'convert_' + path64Base + '_' + toBase64(destGifFile);
                        console.log(command + ' ... ');
                        exec('echo ' + command + ' > convertfifo');
                        //cproc.spawn(command);
                        console.log('ok');
                        //exec('mplayer ' + movie + ' -frames 1 -ss 40 -vo png; mv ' + screenshotFile + ' ' + directoryMovieTmp, function() {});
                        var sqlInsertMovie = 'INSERT INTO movies (path, subtitles, screenshot) VALUES (?, ?, ?)';
                        var statement = db.prepare(sqlInsertMovie);
                        statement.run(path64Base, subtitles, directoryMovieTmp + '/' + screenshotFile);
                        statement.finalize();
                    }

                });

            });

        }

    }

}

files.readdir(pathToLocateMovies, function(error, filesArray) {

    for (var i = 0; i < filesArray.length; i++) {

        directoryOfMovie = pathToLocateMovies + '/' + filesArray[i];

        if (files.statSync(directoryOfMovie).isDirectory()) {

            var filesOfDirectory = files.readdirSync(directoryOfMovie);
            processDirectory(filesOfDirectory);

        }
    }

});

var server = restify.createServer({name: "mediacenter"});

server.use(restify.queryParser());
server.use(restify.bodyParser());
server.use(restify.CORS());

function listMovies(request, response, next) {

    response.setHeader('Access-Control-Allow-Origin', '*');

    db.serialize(function() {

        db.all('SELECT * FROM movies', function(error, rows) {
            response.send(200, rows);
        });

    });

    next();
}

function getImage(request, response, next) {

    response.setHeader('Access-Control-Allow-Origin', '*');

    db.serialize(function() {
        db.each('SELECT * FROM movies WHERE id = \'' + request.params.id + '\'', function(error, row) {
            var filePath = row.screenshot;
            files.readFile(filePath, function(err, data) {
                response.contentType = mime.lookup(filePath);
                response.writeHead(200);
                response.end(data);
            });
        });
    });

    return next();
}

function playMovie(request, response, next) {


    response.setHeader('Access-Control-Allow-Origin', '*');

    response.writeHead(200);
    response.end('OK');

    db.serialize(function() {
        db.each('SELECT * FROM movies WHERE id = \'' + request.params.id + '\'', function(error, row) {

            var subtitle = request.query.sub;

	    exec('killall -9 mplayer');

            var command = 'play_' + row.path + '_' + subtitle;

            console.log('command = ' + command);

            exec('echo ' + command + ' > convertfifo');
            
        });
    });

    return next();
}

function interfacePlayer(request, response, next) {

    response.setHeader('Access-Control-Allow-Origin', '*');
    response.writeHead(200);

    db.serialize(function() {
        db.all('SELECT * FROM movies;', function(error, rows) {

            var html = '';
            html += '<html><head>';
            html += '<script type="text/javascript" language="Javascript" src="https://ajax.googleapis.com/ajax/libs/jquery/1.4.4/jquery.min.js"></script>';
            html += '<script type="text/javascript" language="Javascript"> function stop() { $.get("/stop", function(){}); } function clickItem(id, sub) { $.get("/play/" + id + "?sub=" + sub, function(){}); } </script>';
            html += '</head><body><br/><br/><center><a href="javascript:stop()">Stop movie</a></center><br/><table width="100%" border="3">';

            for (var i = 0; i < rows.length; i++) {
                html += '<tr>';
                html += '<td align="center"><img width="150" height="130" src="/image/' + rows[i].id + '"/></td>';
                html += '<td align="center">';

                var titleParts = fromBase64(rows[i].path).split('/');
                html += titleParts[titleParts.length - 1] + '<br/>';

                html += '<a href="javascript:clickItem(' + rows[i].id + ',\'nothing\')">No subtitle</a><br/>';

                var subtitles = rows[i].subtitles.split(';');

                for (var j = 0; j < subtitles.length; j++) {
                    var subtitleParts = subtitles[j].split('/');
                    html += '<a href="javascript:clickItem(' + rows[i].id + ',\'' + toBase64(subtitles[j]) + '\')">' + subtitleParts[subtitleParts.length - 1] + '</a><br/>';
                }

                html += '</td>';
                html += '</tr>';
            }

            html += '</table></body></html>';

            response.end(html);

            console.log(rows);

        });
    });

    return next();
}

function stopPlayer(request, response, next) {

    response.setHeader('Access-Control-Allow-Origin', '*');

    response.writeHead(200);
    response.end('OK');

    exec('killall mplayer; ');

    return next();

}

server.get({path: '/list', version: '0.0.1'}, listMovies);
server.get({path: '/image/:id', version: '0.0.1'}, getImage);
server.get({path: '/play/:id', version: '0.0.1'}, playMovie);
server.get({path: '/interface', version: '0.0.1'}, interfacePlayer);
server.get({path: '/stop', version: '0.0.1'}, stopPlayer);

server.listen('9090', '0.0.0.0', function() {

});
