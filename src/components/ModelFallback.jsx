import { Component } from 'react'

/**
 * Renders `fallback` if loading a GLB throws.
 *
 * Evolution tiers ship with `model: null` until real assets exist, but a typo
 * in a path or a half-exported GLB should degrade to the primitive dino rather
 * than blanking the whole canvas.
 */
export default class ModelFallback extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.warn('[dino] model failed to load, using placeholder geometry:', error?.message)
  }

  componentDidUpdate(prevProps) {
    // A new tier gets a fresh chance to load its own model.
    if (prevProps.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false })
    }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
