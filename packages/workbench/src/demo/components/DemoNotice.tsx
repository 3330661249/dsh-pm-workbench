export function DemoNotice() {
  return <aside className="demo-notice" role="status">
    <span className="notice-dot" aria-hidden="true" />
    <div><p>演示数据，未连接 DeepSeek Harness，未调用真实模型。</p>
      <p>仅保存在当前页面内存中；刷新或关闭页面后会丢失。</p></div>
  </aside>
}
