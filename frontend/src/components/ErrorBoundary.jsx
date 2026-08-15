import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="page">
          <h1>Something went wrong</h1>
          <p className="error">{this.state.error.message}</p>
          {this.props.fallback}
        </div>
      );
    }
    return this.props.children;
  }
}
