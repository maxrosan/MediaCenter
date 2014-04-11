
var pathToLocateMovies = '/home/mrosan/Downloads/movies';

var files = require('fs');
var sqlite = require('sqlite3');
var restify = require('restify');
var sys = require('sys');
var exec = require('child_process').exec;
var mime = require('mime');

var db = new sqlite.Database('movies.db');

var moviesExtension = ['mkv', 'mp4'];
var subtitleExtension = ['srt'];

db.serialize(function() {
	db.run('CREATE TABLE IF NOT EXISTS movies (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT NOT NULL, subtitles TEXT, screenshot TEXT NOT NULL);');
});

files.readdir(pathToLocateMovies, function(error, filesArray) {

	for (var i = 0; i < filesArray.length; i++) {
		
		directoryOfMovie = pathToLocateMovies + '/' + filesArray[i];
		
		if (files.statSync(directoryOfMovie).isDirectory()) {
			
			files.readdir(directoryOfMovie, function(errorReadingMovieDirectory, filesMovieDirectory) {

				var subtitles = '';

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
							var screenshotFile = '00000001.png';

							db.all('SELECT * FROM movies WHERE path = \'' + movie + '\'', function(errorSelect, rowsSelect) {
								if (rowsSelect.length == 0) {
									exec('mplayer ' + movie + ' -frames 1 -ss 40 -vo png; mv ' + screenshotFile + ' ' + directoryMovieTmp, function() {});
									var sqlInsertMovie = 'INSERT INTO movies (path, subtitles, screenshot) VALUES (?, ?, ?)';
									var statement = db.prepare(sqlInsertMovie);
									statement.run(movie, subtitles, directoryMovieTmp + '/' + screenshotFile);
									statement.finalize();								
								}

							});

						});
						
					}

				}

			});

		}
	}

});

var server = restify.createServer({name : "mediacenter"});

server.use(restify.queryParser());
server.use(restify.bodyParser());
server.use(restify.CORS());

function listMovies(request, response, next) {

	response.setHeader('Access-Control-Allow-Origin','*');

	db.serialize(function() {

		db.all('SELECT * FROM movies', function(error, rows) {
			response.send(200, rows);
		});

	});

	next();
}

function getImage(request, response, next) {

	response.setHeader('Access-Control-Allow-Origin','*');

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


	response.setHeader('Access-Control-Allow-Origin','*');

	response.writeHead(200);
	response.end('OK');

	db.serialize(function() {
		db.each('SELECT * FROM movies WHERE id = \'' + request.params.id + '\'', function(error, row) {
			exec('mplayer -fs ' + row.path + ' &', function() {});
		});
	});

	return next();
}

server.get({path : '/list', version : '0.0.1'} , listMovies);
server.get({path : '/image/:id', version : '0.0.1'} , getImage);
server.get({path : '/play/:id', version : '0.0.1'} , playMovie);

server.listen('9090', 'localhost', function() {

});