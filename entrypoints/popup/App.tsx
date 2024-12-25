import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { useEffect, useState } from 'react';

interface Extension {
  id: string;
  name: string;
  enabled: boolean;
  description: string;
  icons?: { size: number; url: string }[];
}

function App() {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExtensions();
  }, []);

  const loadExtensions = async () => {
    const exts = await chrome.management.getAll();
    // Filter out this extension
    const filteredExts = exts.filter(ext => ext.id !== chrome.runtime.id);
    setExtensions(filteredExts);

    // Update storage with current states
    const currentState = filteredExts.map(ext => ({
      id: ext.id,
      enabled: ext.enabled
    }));
    await chrome.storage.local.set({ lastKnownStates: currentState });

    setLoading(false);
  };

  const toggleExtension = async (id: string, enabled: boolean) => {
    await chrome.management.setEnabled(id, enabled);
    await loadExtensions(); // Reload and update storage
  };

  const toggleAll = async (enabled: boolean) => {
    for (const ext of extensions) {
      await chrome.management.setEnabled(ext.id, enabled);
    }
    await loadExtensions(); // Reload and update storage
  };

  if (loading) {
    return (
      <div className="flex h-[200px] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="w-[400px] p-4">
      <div className="mb-4 flex gap-2">
        <Button
          variant="default"
          onClick={() => toggleAll(true)}
          className="flex-1"
        >
          Enable All
        </Button>
        <Button
          variant="destructive"
          onClick={() => toggleAll(false)}
          className="flex-1"
        >
          Disable All
        </Button>
      </div>

      <ScrollArea className="h-[500px] pr-4">
        <div className="space-y-2">
          {extensions.map((ext) => (
            <Card key={ext.id}>
              <CardContent className="flex items-center gap-3 p-3">
                <div className="flex flex-1 items-center gap-3">
                  {ext.icons?.[0] && (
                    <img
                      src={ext.icons[0].url}
                      alt={ext.name}
                      className="h-8 w-8"
                    />
                  )}
                  <div className="flex-1 text-left">
                    <h3 className="text-sm font-medium leading-none">{ext.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {ext.description}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={ext.enabled}
                  onCheckedChange={(checked) => toggleExtension(ext.id, checked)}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export default App;
