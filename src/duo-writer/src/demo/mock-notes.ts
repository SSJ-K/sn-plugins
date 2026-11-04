import {REGISTERED_EVENT, STREAM_EVENT_DATA} from './mock-events';
import {TestData} from './test-data';

let componentData = {};

export class MockStandardNotes {
  private childWindow;
  private streamEvent;
  private streamData;
  private current: TestData;

  constructor(data: TestData, private onSave: () => void) {
    this.updateStream(data);
    window.addEventListener('message', this.handleMessage.bind(this));
  }

  public onReady(childWindow) {
    this.childWindow = childWindow;
    childWindow.postMessage({
      ...REGISTERED_EVENT,
      componentData
    });
  }

  public toggleLock(isLocked: boolean) {
    this.streamData.item.content.appData['org.standardnotes.sn']['locked'] = isLocked;
    this.childWindow.postMessage({
      action: 'reply',
      data: this.streamData,
      original: this.streamEvent
    }, '*');
  }

  public toggleTheme(isDark: boolean) {
    const themes = isDark ? ['dark.css'] : [];
    this.childWindow.postMessage({
      action: 'themes',
      data: {
        themes
      }
    }, '*');
  }

  public changeData(data: TestData) {
    this.updateStream(data);
    this.childWindow.postMessage({
      action: 'reply',
      data: this.streamData,
      original: this.streamEvent
    }, '*');
  }

  private handleMessage(e: MessageEvent) {
    const data = e.data;
    if (data.action === 'stream-context-item') {
      this.streamEvent = data;
      this.childWindow.postMessage({
        action: 'reply',
        data: this.streamData,
        original: data
      }, '*');
    } else if (data.action === 'save-items') {
      // Keep what the plugin saved (text and per-note metadata), as the real app does.
      const saved = data.data?.items?.[0];
      if (saved && this.current) {
        this.current.text = saved.content.text;
        this.current.meta = saved.content.appData?.[saved.content.editorIdentifier];
      }
      this.onSave();
      this.childWindow.postMessage({
        action: 'reply',
        data: {},
        original: data
      }, '*');
    } else if (data.action === 'set-component-data') {
      componentData = data.data.componentData;
    }
  }

  private updateStream(data: TestData) {
    this.current = data;
    this.streamData = JSON.parse(JSON.stringify(STREAM_EVENT_DATA));
    this.streamData.item.content.text = data.text;
    this.streamData.item.content.appData[this.streamData.item.content.editorIdentifier] = data.meta;
  }
}
