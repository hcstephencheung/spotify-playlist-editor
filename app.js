/**
 * This is an example of a basic node.js script that performs
 * the Authorization Code oAuth2 flow to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/web-api/authorization-guide/#authorization_code_flow
 */

var express = require("express"); // Express web server framework
var request = require("request"); // "Request" library
var cors = require("cors");
var querystring = require("querystring");
var cookieParser = require("cookie-parser");
require("dotenv").load();

var client_id = "" || process.env.CLIENT_ID; // Your client id
var client_secret = "" || process.env.CLIENT_SECRET; // Your secret
var redirect_uri = "http://localhost:8888/callback/"; // Your redirect uri
var appRedirect_uri = "http://localhost:1234/token"; // Your redirect uri
var allowedOrigins = "http://localhost:1234";

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function(length) {
  var text = "";
  var possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = "spotify_auth_state";
var acKey = "spotify-ac-key";

var app = express();
app.use(cors({ origin: "http://localhost:1234" }));

app
  .use(express.static(__dirname + "/public"))
  .use(cors())
  .use(cookieParser());

app.get("/login", function(req, res) {
  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = "user-read-private user-read-email playlist-read-private";
  res.redirect(
    "https://accounts.spotify.com/authorize?" +
      querystring.stringify({
        response_type: "code",
        client_id: client_id,
        scope: scope,
        redirect_uri: redirect_uri,
        state: state
      })
  );
});

app.get("/appLogin", function(req, res) {
  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = "user-read-private user-read-email playlist-read-private";
  var spotifyLoginUrl =
    "https://accounts.spotify.com/authorize?" +
    querystring.stringify({
      response_type: "code",
      client_id: client_id,
      scope: scope,
      redirect_uri: appRedirect_uri,
      state: state
    });

  res
    .status(200)
    .send({ stateKey: stateKey, stateValue: state, loginUrl: spotifyLoginUrl });
});

app.get("/appCallback", function(req, res) {
  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  res.setHeader("Access-Control-Allow-Origin", allowedOrigins);
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (state === null || state !== storedState) {
    res.status(400).send({
      error: storedState
    });
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: "https://accounts.spotify.com/api/token",
      form: {
        code: code,
        redirect_uri: appRedirect_uri,
        grant_type: "authorization_code"
      },
      headers: {
        Authorization:
          "Basic " +
          new Buffer(client_id + ":" + client_secret).toString("base64")
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        var access_token = body.access_token,
          refresh_token = body.refresh_token;

        var options = {
          url: "https://api.spotify.com/v1/me",
          headers: { Authorization: "Bearer " + access_token },
          json: true
        };

        console.log("App Access Token is: ", access_token);

        res.cookie(acKey, access_token);
        // we can also pass the token to the browser to make requests from there
        res.status(200).send({ ac: access_token, key: acKey });
      } else {
        res.status(400).send(error);
      }
    });
  }
});

app.get("/callback", function(req, res) {
  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect(
      "/#" +
        querystring.stringify({
          error: "state_mismatch"
        })
    );
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: "https://accounts.spotify.com/api/token",
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: "authorization_code"
      },
      headers: {
        Authorization:
          "Basic " +
          new Buffer(client_id + ":" + client_secret).toString("base64")
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        var access_token = body.access_token,
          refresh_token = body.refresh_token;

        var options = {
          url: "https://api.spotify.com/v1/me",
          headers: { Authorization: "Bearer " + access_token },
          json: true
        };

        console.log("Access Token is: ", access_token);

        // use the access token to access the Spotify Web API
        request.get(options, function(error, response, body) {
          // console.log(body);
        });

        res.cookie(acKey, access_token);
        // we can also pass the token to the browser to make requests from there
        res.redirect(
          "/#" +
            querystring.stringify({
              access_token: access_token,
              refresh_token: refresh_token
            })
        );
      } else {
        res.redirect(
          "/#" +
            querystring.stringify({
              error: "invalid_token"
            })
        );
      }
    });
  }
});

app.get("/refresh_token", function(req, res) {
  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: "https://accounts.spotify.com/api/token",
    headers: {
      Authorization:
        "Basic " +
        new Buffer(client_id + ":" + client_secret).toString("base64")
    },
    form: {
      grant_type: "refresh_token",
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        access_token: access_token
      });
    }
  });
});

app.get("/playlists", function(req, res) {
  // your application requests refresh and access tokens
  // after checking the state parameter
  var access_token_cookie = req.cookies[acKey];
  var access_token = access_token_cookie || "";
  let data = {};

  console.log("=== playlists access token ===", access_token_cookie);

  var options = {
    url: "https://api.spotify.com/v1/me/playlists",
    headers: { Authorization: "Bearer " + access_token },
    json: true
  };

  // use the access token to access the Spotify Web API
  request.get(options, function(error, response, body) {
    if (body && body.error && body.error.status && body.error.status === 401) {
      res.redirect("/");
    } else {
      let data = {};
      if (body) {
        data = body.items.map(playlistItem => {
          // pick out attributes I want
          const { name, id, href } = playlistItem;
          return { name, id, href };
        });
      }
      res.setHeader("Access-Control-Allow-Origin", allowedOrigins);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.send(data);
    }
  });
});

app.get("/playlists", function(req, res) {
  // your application requests refresh and access tokens
  // after checking the state parameter
  var access_token_cookie = req.cookies[acKey];
  var access_token = access_token_cookie || "";

  var options = {
    url: "https://api.spotify.com/v1/me/playlists",
    headers: { Authorization: "Bearer " + access_token },
    json: true
  };

  res.setHeader("Access-Control-Allow-Origin", allowedOrigins);
  res.setHeader("Access-Control-Allow-Credentials", "true");

  // use the access token to access the Spotify Web API
  request.get(options, function(error, response, body) {
    if (body && body.error && body.error.status && body.error.status === 401) {
      res.redirect("/");
    } else {
      let data = {};
      if (body) {
        data = body.items.map(playlistItem => {
          // pick out attributes I want
          const { name, id, href } = playlistItem;
          return { name, id, href };
        });
      }

      res.send(data);
    }
  });
});

app.get("/playlist/:id", function(req, res) {
  // your application requests refresh and access tokens
  // after checking the state parameter
  var access_token_cookie = req.cookies[acKey];
  var access_token = access_token_cookie || "";
  const trackId = req.params.id;
  const fieldsParams = "fields=items(track(name,href,album(name,href)))";

  var options = {
    url: `https://api.spotify.com/v1/playlists/${trackId}/tracks?${fieldsParams}`,
    headers: { Authorization: "Bearer " + access_token },
    json: true
  };

  res.setHeader("Access-Control-Allow-Origin", allowedOrigins);
  res.setHeader("Access-Control-Allow-Credentials", "true");

  // use the access token to access the Spotify Web API
  request.get(options, function(error, response, body) {
    if (body && body.error && body.error.status && body.error.status === 401) {
      res.redirect("/");
    } else {
      let data = body.items;
      console.log("=== playlist ===", body);
      res.status(200).send(JSON.stringify(data));
    }
  });
});

console.log("Listening on 8888");
app.listen(8888);
