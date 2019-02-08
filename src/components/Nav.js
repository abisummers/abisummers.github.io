import React, { Component } from "react";
import { NavLink } from "react-router-dom";

class Nav extends Component {
  state = {};
  render() {
    return (
      <>
        <nav>
          <NavLink exact to="/">
            Home
          </NavLink>
          <NavLink to="/about">About Me</NavLink>

          <NavLink to="/projects">Projects</NavLink>
        </nav>
      </>
    );
  }
}

export default Nav;
