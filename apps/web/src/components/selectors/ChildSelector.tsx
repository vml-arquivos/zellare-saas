import React, { useState, useEffect } from 'react';
import { Search, Users, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import http from '../../api/http';

interface Child {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl?: string;
  dateOfBirth: string;
  classroomName?: string;
}

interface ChildSelectorProps {
  onSelect: (childIds: string[]) => void;
  multiple?: boolean;
  classroomId?: string;
  selectedIds?: string[];
  maxSelection?: number;
}

export default function ChildSelector({
  onSelect,
  multiple = false,
  classroomId,
  selectedIds = [],
  maxSelection,
}: ChildSelectorProps) {
  const [children, setChildren] = useState<Child[]>([]);
  const [filteredChildren, setFilteredChildren] = useState<Child[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChildren();
  }, [classroomId]);

  useEffect(() => {
    filterChildren();
  }, [searchTerm, children]);

  const fetchChildren = async () => {
    try {
      setLoading(true);
      const response = classroomId
        ? await http.get(`/lookup/classrooms/${classroomId}/children`)
        : await http.get('/children');
      const payload = response.data;
      const rawChildren = Array.isArray(payload) ? payload : (payload?.children ?? payload?.data ?? []);
      const realChildren: Child[] = rawChildren
        .filter((child: any) => child?.id && child?.firstName && child?.lastName)
        .map((child: any) => ({
          id: child.id,
          firstName: child.firstName,
          lastName: child.lastName,
          photoUrl: child.photoUrl ?? undefined,
          dateOfBirth: child.dateOfBirth,
          classroomName: child.classroomName ?? child.enrollments?.[0]?.classroom?.name,
        }));
      setChildren(realChildren);
      setFilteredChildren(realChildren);
    } catch (error) {
      console.error('Erro ao buscar crianças:', error);
      setChildren([]);
      setFilteredChildren([]);
    } finally {
      setLoading(false);
    }
  };

  const filterChildren = () => {
    if (!searchTerm) {
      setFilteredChildren(children);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = children.filter(
      (child) =>
        child.firstName.toLowerCase().includes(term) ||
        child.lastName.toLowerCase().includes(term)
    );
    setFilteredChildren(filtered);
  };

  const toggleSelection = (childId: string) => {
    const newSelected = new Set(selected);

    if (newSelected.has(childId)) {
      newSelected.delete(childId);
    } else {
      if (!multiple) {
        newSelected.clear();
      }
      if (maxSelection && newSelected.size >= maxSelection) {
        return;
      }
      newSelected.add(childId);
    }

    setSelected(newSelected);
    onSelect(Array.from(newSelected));
  };

  const selectAll = () => {
    const allIds = filteredChildren.map((c) => c.id);
    setSelected(new Set(allIds));
    onSelect(allIds);
  };

  const clearSelection = () => {
    setSelected(new Set());
    onSelect([]);
  };

  const getInitials = (child: Child) => {
    return `${child.firstName[0]}${child.lastName[0]}`.toUpperCase();
  };

  const getAge = (dateOfBirth: string) => {
    const birth = new Date(dateOfBirth);
    const today = new Date();
    const months = (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
    
    if (months < 12) {
      return `${months} meses`;
    }
    const years = Math.floor(months / 12);
    return `${years} ${years === 1 ? 'ano' : 'anos'}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-400">Carregando crianças...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header com busca e ações */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Buscar por nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-gray-800 border-gray-700 text-white"
          />
        </div>
        {multiple && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAll}
              className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
            >
              Selecionar Todos
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearSelection}
              className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
            >
              Limpar
            </Button>
          </div>
        )}
      </div>

      {/* Info de seleção */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Users className="h-4 w-4" />
        <span>
          {selected.size} {selected.size === 1 ? 'criança selecionada' : 'crianças selecionadas'}
        </span>
        {maxSelection && (
          <Badge variant="outline" className="ml-2">
            Máximo: {maxSelection}
          </Badge>
        )}
      </div>

      {/* Grid de crianças */}
      {filteredChildren.length === 0 ? (
        <div className="text-center py-8 text-[var(--text-tertiary)]">
          Nenhuma criança encontrada
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredChildren.map((child) => {
            const isSelected = selected.has(child.id);
            return (
              <Card
                key={child.id}
                onClick={() => toggleSelection(child.id)}
                className={`cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? 'bg-[var(--surface-brand)] border-[var(--border-brand)] shadow-lg scale-105'
                    : 'bg-[var(--surface-card)] border-[var(--border-default)] hover:bg-[var(--surface-card-hover)] hover:border-[var(--border-strong)]'
                }`}
              >
                <CardContent className="p-4 flex flex-col items-center gap-2">
                  {/* Foto ou iniciais */}
                  <div className="relative">
                    {child.photoUrl ? (
                      <img
                        src={child.photoUrl}
                        alt={`${child.firstName} ${child.lastName}`}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-normal ${
                          isSelected
                            ? 'bg-[var(--accent-violet)] text-[var(--on-accent)]'
                            : 'bg-[var(--surface-brand)] text-[var(--text-brand-soft)]'
                        }`}
                      >
                        {getInitials(child)}
                      </div>
                    )}
                    {/* Checkbox visual */}
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 bg-[var(--surface-card)] border border-[var(--border-default)] rounded-full p-1">
                        <Check className="h-4 w-4 text-[var(--accent-violet)]" />
                      </div>
                    )}
                  </div>

                  {/* Nome */}
                  <div className="text-center">
                    <p className="font-normal text-[var(--text-primary)]">
                      {child.firstName}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {child.lastName}
                    </p>
                  </div>

                  {/* Idade */}
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      isSelected
                        ? 'ds-badge-brand'
                        : 'ds-badge-neutral'
                    }`}
                  >
                    {getAge(child.dateOfBirth)}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
