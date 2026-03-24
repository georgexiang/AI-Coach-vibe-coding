import React from 'react';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';

type FormFieldType = 'input' | 'select' | 'slider' | 'textarea';

interface FormFieldProps {
  label: string;
  type?: FormFieldType;
  inputType?: string;
  value?: string | number;
  onChange?: (value: any) => void;
  options?: { value: string; label: string }[];
  error?: string;
  required?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

export function FormField({
  label,
  type = 'input',
  inputType = 'text',
  value,
  onChange,
  options = [],
  error,
  required,
  placeholder,
  min,
  max,
  step,
  className,
}: FormFieldProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {/* Input */}
      {type === 'input' && (
        <Input
          type={inputType}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          className={error ? 'border-destructive' : ''}
        />
      )}

      {/* Select */}
      {type === 'select' && (
        <Select value={value as string} onValueChange={onChange}>
          <SelectTrigger className={error ? 'border-destructive' : ''}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Slider */}
      {type === 'slider' && (
        <div className="pt-2">
          <Slider
            value={[value as number]}
            onValueChange={(vals) => onChange?.(vals[0])}
            min={min}
            max={max}
            step={step}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{min}</span>
            <span className="font-semibold text-foreground">{value}</span>
            <span>{max}</span>
          </div>
        </div>
      )}

      {/* Textarea */}
      {type === 'textarea' && (
        <textarea
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          className={`flex min-h-[80px] w-full rounded-md border border-input bg-input-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
            error ? 'border-destructive' : ''
          }`}
        />
      )}

      {/* Error Message */}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
