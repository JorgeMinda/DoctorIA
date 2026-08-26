import { useState, useEffect } from "react";
import { useQuery } from "wasp/client/operations";
import { searchCIE11 } from "wasp/client/operations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../client/components/ui/dialog";
import { Input } from "../../client/components/ui/input";
import { Button } from "../../client/components/ui/button";
import { Loader2, Search } from "lucide-react";

export type CIE11Result = {
  code: string;
  title: string;
  uri: string;
};

interface CIE11SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (result: CIE11Result) => void;
}

export function CIE11SearchDialog({
  open,
  onOpenChange,
  onSelect,
}: CIE11SearchDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const {
    data: results,
    isLoading,
    isFetching,
    error,
  } = useQuery(
    searchCIE11,
    { query: debouncedTerm },
    {
      enabled: debouncedTerm.length >= 2,
    }
  );

  const handleSelect = (result: CIE11Result) => {
    onSelect(result);
    setSearchTerm("");
    setDebouncedTerm("");
    onOpenChange(false);
  };

  const isSearching = isLoading || isFetching;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Buscar en CIE-11 (OMS)</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar diagnóstico, enfermedad, síntoma..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
          <div className="min-h-[200px] max-h-[300px] overflow-y-auto border rounded-md p-1">
            {error ? (
              <div className="p-4 text-sm text-destructive text-center">
                Error al buscar: {error instanceof Error ? error.message : "Error desconocido"}
              </div>
            ) : debouncedTerm.length < 2 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                Escriba al menos 2 caracteres para buscar
              </div>
            ) : isSearching ? (
              <div className="p-4 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : results?.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                No se encontraron resultados
              </div>
            ) : (
              <ul className="flex flex-col gap-1">
                {results?.map((res: CIE11Result) => (
                  <li key={res.uri}>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-left h-auto py-2 px-3 whitespace-normal"
                      onClick={() => handleSelect(res)}
                    >
                      <div>
                        <span className="font-semibold text-primary block">
                          {res.code}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {res.title}
                        </span>
                      </div>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
