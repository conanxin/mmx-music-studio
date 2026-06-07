import { Component } from 'react'
import './app.scss'

class App extends Component {
  componentDidMount() {}

  componentDidShow() {}

  componentDidHide() {}

  componentDidCatchError() {}

  // this.props.children 是将要被渲染的页面组件
  render() {
    return this.props.children
  }
}

export default App