import React from 'react';
import ReactDOM from 'react-dom';
import {BrowserRouter} from 'react-router-dom';
import {createBrowserHistory} from 'history';

ReactDOM.render(<p>hello react!!</p>,
  document.getElementById('root')
);
console.log('the browserrouter:', BrowserRouter, createBrowserHistory);
