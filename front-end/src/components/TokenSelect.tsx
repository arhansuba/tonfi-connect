import React, { useState, useCallback, useMemo } from 'react';
import { Search, ChevronDown, ExternalLink, Star, StarOff, Badge, Command } from 'lucide-react';
import { Dialog, DialogTrigger, DialogContent, DialogTitle } from '@radix-ui/react-dialog';
import { ScrollArea } from '@radix-ui/react-scroll-area';
import { CommandInput, CommandList, CommandEmpty, CommandItem } from 'cmdk';
import { Button } from './ui/button';
import { DialogHeader } from './ui/dialog';


interface Token {
    symbol: string;
    name: string;
    address: string;
    icon: string;
    decimals: number;
    balance?: string;
    price?: number;
    volume24h?: number;
    favorite?: boolean;
}

interface TokenSelectProps {
    value: Token | null;
    onChange: (token: Token) => void;
    excludeToken?: Token | null;
    onMaxClick?: () => void;
    showBalance?: boolean;
    label?: string;
}

// Common tokens that will appear at the top
const COMMON_TOKENS: Token[] = [
    {
        symbol: 'TON',
        name: 'Toncoin',
        address: 'EQ...',
        icon: '/tokens/ton.svg',
        decimals: 9,
        price: 2.45,
        volume24h: 1234567
    },
    {
        symbol: 'USDT',
        name: 'Tether USD',
        address: 'EQ...',
        icon: '/tokens/usdt.svg',
        decimals: 6,
        price: 1.00,
        volume24h: 987654
    },
    {
        symbol: 'WTON',
        name: 'Wrapped TON',
        address: 'EQ...',
        icon: '/tokens/wton.svg',
        decimals: 9,
        price: 2.45,
        volume24h: 456789
    },
];

// Additional tokens
const ADDITIONAL_TOKENS: Token[] = [
    {
        symbol: 'JETTON',
        name: 'Sample Jetton',
        address: 'EQ...',
        icon: '/tokens/jetton.svg',
        decimals: 9,
        price: 0.5,
        volume24h: 123456
    },
    // Add more tokens here
];

export const TokenSelect: React.FC<TokenSelectProps> = ({
    value,
    onChange,
    excludeToken,
    onMaxClick,
    showBalance = true,
    label = 'Select Token'
}) => {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [favorites, setFavorites] = useState<Set<string>>(
        new Set(JSON.parse(localStorage.getItem('favoriteTokens') || '[]'))
    );

    // Combine and sort tokens
    const allTokens = useMemo(() => {
        const tokens = [...COMMON_TOKENS, ...ADDITIONAL_TOKENS]
            .filter(token => token !== excludeToken)
            .map(token => ({
                ...token,
                favorite: favorites.has(token.address)
            }));

        return tokens.sort((a, b) => {
            // Favorites first
            if (a.favorite && !b.favorite) return -1;
            if (!a.favorite && b.favorite) return 1;
            // Then by volume
            return (b.volume24h || 0) - (a.volume24h || 0);
        });
    }, [excludeToken, favorites]);

    // Filter tokens based on search
    const filteredTokens = useMemo(() => {
        const query = searchQuery.toLowerCase();
        return allTokens.filter(token => 
            token.symbol.toLowerCase().includes(query) ||
            token.name.toLowerCase().includes(query) ||
            token.address.toLowerCase().includes(query)
        );
    }, [allTokens, searchQuery]);

    const toggleFavorite = useCallback((tokenAddress: string) => {
        setFavorites(prev => {
            const newFavorites = new Set(prev);
            if (newFavorites.has(tokenAddress)) {
                newFavorites.delete(tokenAddress);
            } else {
                newFavorites.add(tokenAddress);
            }
            localStorage.setItem('favoriteTokens', JSON.stringify(Array.from(newFavorites)));
            return newFavorites;
        });
    }, []);

    const formatPrice = (price?: number) => {
        if (!price) return 'N/A';
        return price < 0.01 ? '< $0.01' : `$${price.toFixed(2)}`;
    };

    const formatVolume = (volume?: number) => {
        if (!volume) return 'N/A';
        if (volume >= 1e9) return `$${(volume / 1e9).toFixed(2)}B`;
        if (volume >= 1e6) return `$${(volume / 1e6).toFixed(2)}M`;
        if (volume >= 1e3) return `$${(volume / 1e3).toFixed(2)}K`;
        return `$${volume.toFixed(2)}`;
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button 
                    variant="outline" 
                    className="w-full justify-between"
                    size="lg"
                >
                    <div className="flex items-center gap-2">
                        {value ? (
                            <>
                                <img
                                    src={value.icon}
                                    alt={value.symbol}
                                    className="w-6 h-6 rounded-full"
                                />
                                <span className="font-medium">{value.symbol}</span>
                                {showBalance && value.balance && (
                                    <span className="text-sm text-gray-500">
                                        ({value.balance})
                                    </span>
                                )}
                            </>
                        ) : (
                            <span>{label}</span>
                        )}
                    </div>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
            </DialogTrigger>
            
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Select Token</DialogTitle>
                </DialogHeader>
                
                <Command className="rounded-lg shadow-md">
                    <CommandInput
                        placeholder="Search token name or address"
                        value={searchQuery}
                        onValueChange={setSearchQuery}
                    />
                    
                    <CommandList>
                        <CommandEmpty>No tokens found.</CommandEmpty>
                        
                        <ScrollArea className="h-[300px]">
                            {filteredTokens.map(token => (
                                <CommandItem
                                    key={token.address}
                                    className="flex items-center justify-between py-3 px-4 hover:bg-gray-100 cursor-pointer"
                                    onSelect={() => {
                                        onChange(token);
                                        setOpen(false);
                                    }}
                                >
                                    <div className="flex items-center gap-3">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="p-0"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleFavorite(token.address);
                                            }}
                                        >
                                            {token.favorite ? (
                                                <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                                            ) : (
                                                <StarOff className="h-4 w-4 text-gray-400" />
                                            )}
                                        </Button>
                                        
                                        <img
                                            src={token.icon}
                                            alt={token.symbol}
                                            className="w-8 h-8 rounded-full"
                                        />
                                        
                                        <div className="flex flex-col">
                                            <span className="font-medium">{token.symbol}</span>
                                            <span className="text-sm text-gray-500">{token.name}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-col items-end">
                                        {showBalance && token.balance && (
                                            <span className="text-sm">
                                                {token.balance}
                                            </span>
                                        )}
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-gray-500">
                                                {formatPrice(token.price)}
                                            </span>
                                            <Badge className="text-xs">
                                                24h: {formatVolume(token.volume24h)}
                                            </Badge>
                                        </div>
                                    </div>
                                </CommandItem>
                            ))}
                        </ScrollArea>
                    </CommandList>
                </Command>
                
                {onMaxClick && value && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onMaxClick}
                        className="mt-2"
                    >
                        Max
                    </Button>
                )}
                
                {value && (
                    <div className="flex items-center justify-between pt-4 border-t">
                        <span className="text-sm text-gray-500">Token Contract</span>
                        <a
                            href={`https://tonscan.org/address/${value.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600"
                        >
                            {`${value.address.slice(0, 6)}...${value.address.slice(-4)}`}
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

// Usage example with styling extensions
export const TokenSelectWithBalance: React.FC<TokenSelectProps & {
    inputValue?: string;
    onInputChange?: (value: string) => void;
}> = ({ inputValue, onInputChange, ...props }) => {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{props.label}</span>
                {props.value?.balance && (
                    <span className="text-sm text-gray-500">
                        Balance: {props.value.balance}
                    </span>
                )}
            </div>
            
            <div className="flex gap-2">
                {onInputChange && (
                    <input
                        type="number"
                        value={inputValue}
                        onChange={(e) => onInputChange(e.target.value)}
                        placeholder="0.0"
                        className="w-full p-2 text-lg bg-transparent border-none focus:outline-none"
                    />
                )}
                <TokenSelect {...props} />
            </div>
        </div>
    );
};