import { useCallback, useState } from 'react'

export function useConfirm() {
const [dialog, setDialog] = useState(null)

const confirm = useCallback((options = {}) => {
const message =
typeof options === 'string'
? options
: options.message || 'Are you sure you want to continue?'

```
const accepted = window.confirm(message)
return Promise.resolve(accepted)
```

}, [])

return { confirm, isOpen: Boolean(dialog), dialog, setDialog }
}