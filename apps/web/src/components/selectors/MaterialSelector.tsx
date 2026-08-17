import React, { useState, useEffect } from 'react';
import { Search, Package, Plus, Minus, ShoppingCart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import http from '../../api/http';

interface Material {
  id: string;
  name: string;
  category: 'HIGIENE' | 'PEDAGOGICO' | 'LIMPEZA' | 'ALIMENTACAO';
  icon: string;
  unit: string;
  description?: string;
}

interface MaterialSelection {
  materialId: string;
  quantity: number;
}

interface MaterialSelectorProps {
  onSelect: (selections: MaterialSelection[]) => void;
  initialSelections?: MaterialSelection[];
}

const MATERIAL_CATEGORIES = {
  HIGIENE: {
    label: 'Higiene',
    color: 'blue',
    icon: '🧼',
  },
  PEDAGOGICO: {
    label: 'Pedagógico',
    color: 'purple',
    icon: '📚',
  },
  LIMPEZA: {
    label: 'Limpeza',
    color: 'green',
    icon: '🧹',
  },
  ALIMENTACAO: {
    label: 'Alimentação',
    color: 'orange',
    icon: '🍽️',
  },
};

export default function MaterialSelector({ onSelect, initialSelections = [] }: MaterialSelectorProps) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [filteredMaterials, setFilteredMaterials] = useState<Material[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('HIGIENE');
  const [selections, setSelections] = useState<Map<string, number>>(
    new Map(initialSelections.map((s) => [s.materialId, s.quantity]))
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMaterials();
  }, []);

  useEffect(() => {
    filterMaterials();
  }, [searchTerm, selectedCategory, materials]);

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      const response = await http.get('/materials/catalog');
      const payload = response.data;
      const rawMaterials = Array.isArray(payload) ? payload : (payload?.data ?? []);
      const allowedCategories = new Set(Object.keys(MATERIAL_CATEGORIES));
      const realMaterials: Material[] = rawMaterials
        .filter((material: any) => material?.id && material?.name)
        .map((material: any) => {
          const category = allowedCategories.has(String(material.category).toUpperCase())
            ? String(material.category).toUpperCase()
            : 'PEDAGOGICO';
          return {
            id: material.id,
            name: material.name,
            category: category as Material['category'],
            icon: MATERIAL_CATEGORIES[category as keyof typeof MATERIAL_CATEGORIES].icon,
            unit: material.unit ?? 'unidade',
            description: material.description ?? undefined,
          };
        });
      setMaterials(realMaterials);
      setFilteredMaterials(realMaterials.filter((material) => material.category === selectedCategory));
    } catch (error) {
      console.error('Erro ao buscar materiais:', error);
      setMaterials([]);
      setFilteredMaterials([]);
    } finally {
      setLoading(false);
    }
  };

  const filterMaterials = () => {
    let filtered = materials.filter((m) => m.category === selectedCategory);

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((m) => m.name.toLowerCase().includes(term));
    }

    setFilteredMaterials(filtered);
  };

  const updateQuantity = (materialId: string, delta: number) => {
    const newSelections = new Map(selections);
    const current = newSelections.get(materialId) || 0;
    const newQuantity = Math.max(0, current + delta);

    if (newQuantity === 0) {
      newSelections.delete(materialId);
    } else {
      newSelections.set(materialId, newQuantity);
    }

    setSelections(newSelections);
    onSelect(
      Array.from(newSelections.entries()).map(([materialId, quantity]) => ({
        materialId,
        quantity,
      }))
    );
  };

  const getTotalItems = () => {
    return Array.from(selections.values()).reduce((sum, qty) => sum + qty, 0);
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      HIGIENE: 'blue',
      PEDAGOGICO: 'purple',
      LIMPEZA: 'green',
      ALIMENTACAO: 'orange',
    };
    return colors[category as keyof typeof colors] || 'gray';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-400">Carregando materiais...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header com busca e resumo */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Buscar material..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-gray-800 border-gray-700 text-white"
          />
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg">
          <ShoppingCart className="h-5 w-5 text-white" />
          <span className="font-semibold text-white">{getTotalItems()} itens</span>
        </div>
      </div>

      {/* Tabs de categorias */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="grid grid-cols-4 bg-gray-800">
          {Object.entries(MATERIAL_CATEGORIES).map(([key, { label, icon }]) => (
            <TabsTrigger key={key} value={key} className="data-[state=active]:bg-gray-700">
              <span className="mr-2">{icon}</span>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.keys(MATERIAL_CATEGORIES).map((category) => (
          <TabsContent key={category} value={category} className="mt-4">
            {filteredMaterials.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                Nenhum material encontrado
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredMaterials.map((material) => {
                  const quantity = selections.get(material.id) || 0;
                  const isSelected = quantity > 0;
                  const color = getCategoryColor(material.category);

                  return (
                    <Card
                      key={material.id}
                      className={`transition-all duration-200 ${
                        isSelected
                          ? `bg-${color}-900/30 border-${color}-500`
                          : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                      }`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-3xl">{material.icon}</span>
                            <div>
                              <CardTitle className="text-sm text-white">{material.name}</CardTitle>
                              <p className="text-xs text-gray-400 mt-1">{material.description}</p>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            {material.unit}
                          </Badge>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateQuantity(material.id, -1)}
                              disabled={quantity === 0}
                              className="h-8 w-8 p-0"
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="font-bold text-white min-w-[2rem] text-center">
                              {quantity}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateQuantity(material.id, 1)}
                              className="h-8 w-8 p-0"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
