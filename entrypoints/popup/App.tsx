import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { logExtensionStateChange, safeSetExtensionState } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface Extension {
  id: string;
  name: string;
  enabled: boolean;
  description?: string;
  icons?: chrome.management.IconInfo[];
}

function App() {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadExtensions();
  }, []);

  async function loadExtensions() {
    try {
      setLoading(true);
      setError(null);

      const exts = await chrome.management.getAll();
      const filteredExts = exts.filter(ext => ext.id !== chrome.runtime.id);

      setExtensions(filteredExts.map(ext => ({
        id: ext.id,
        name: ext.name,
        enabled: ext.enabled,
        description: ext.description,
        icons: ext.icons
      })));
    } catch (err) {
      console.error('Failed to load extensions:', err);
      setError('Failed to load extensions. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function toggleExtension(id: string, name: string, enabled: boolean) {
    try {
      setError(null);
      const success = await safeSetExtensionState(id, enabled);

      if (success) {
        logExtensionStateChange(id, name, enabled);

        // Update local state
        setExtensions(extensions.map(ext =>
          ext.id === id ? { ...ext, enabled } : ext
        ));
      } else {
        setError(`Failed to ${enabled ? 'enable' : 'disable'} ${name}`);
      }
    } catch (err) {
      console.error(`Failed to toggle extension ${name}:`, err);
      setError(`Failed to ${enabled ? 'enable' : 'disable'} ${name}`);
    }
  }

  async function toggleAll(enabled: boolean) {
    try {
      setError(null);
      let success = true;

      for (const ext of extensions) {
        if (ext.enabled !== enabled) {
          const result = await safeSetExtensionState(ext.id, enabled);
          if (result) {
            logExtensionStateChange(ext.id, ext.name, enabled);
          } else {
            success = false;
          }
        }
      }

      if (success) {
        // Update local state
        setExtensions(extensions.map(ext => ({ ...ext, enabled })));
      } else {
        setError(`Failed to ${enabled ? 'enable' : 'disable'} some extensions`);
        // Refresh to get actual states
        await loadExtensions();
      }
    } catch (err) {
      console.error(`Failed to toggle all extensions:`, err);
      setError(`Failed to ${enabled ? 'enable' : 'disable'} extensions`);
      await loadExtensions();
    }
  }

  if (loading) {
    return (
      <div className="flex h-[200px] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="w-[400px] p-4">
      {error && (
        <div className="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

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
          {extensions.length === 0 ? (
            <p className="text-center text-muted-foreground">No extensions found</p>
          ) : (
            extensions.map((ext) => (
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
                    onCheckedChange={(checked) => toggleExtension(ext.id, ext.name, checked)}
                  />
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default App;
