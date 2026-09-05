import { createRoot } from 'react-dom/client'
import { DemoApp } from '../src/demo/DemoApp.js'
import './demo.css'

const root = document.getElementById('root')
if (!root) throw new Error('缺少 Demo 挂载节点 #root。')
createRoot(root).render(<DemoApp />)
