import React, { Component } from "react";
import Nav from "./components/Nav";
import { NavLink, Route, Switch } from "react-router-dom";
import Projects from "./components/Project-list";
import About from "./components/About";

import Main from "./components/Main";

class App extends Component {
  render() {
    return (
      <>
        <Nav />
        <Main />
        <p>
          You can follow me on{" "}
          <a target="_" href="https://github.com/abisummers">
            GitHub
          </a>{" "}
          or{" "}
          <a target="_" href="https://twitter.com/abijsummers">
            Twitter
          </a>
        </p>

        <Switch>
          <Route exact path="/" />
          <Route path="/projects" component={Projects} />
          <Route path="/about" component={About} />
        </Switch>
      </>
    );
  }
}

export default App;
