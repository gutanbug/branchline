import { Workspace } from './design-system/Workspace'
import { DesktopApp } from './app/DesktopApp'

export default function App() {
  const demo = new URLSearchParams(window.location.search).has('demo')
  return <div className="bl-system" lang="ko">{demo ? <Workspace /> : <DesktopApp />}</div>
}
