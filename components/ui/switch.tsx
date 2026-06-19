"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-border/70 bg-secondary p-1 shadow-xs transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[size=sm]:h-5 data-[size=sm]:w-9 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=unchecked]:bg-secondary",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-muted-foreground ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=checked]:bg-primary-foreground data-[state=unchecked]:translate-x-0 group-data-[size=sm]/switch:size-3"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
