import * as THREE from 'three'
import * as CANNON from 'cannon'

export default class Picker
{
    constructor(_options)
    {
        this.sizes = _options.sizes
        this.camera = _options.camera
        this.scene = _options.scene
        this.physics = _options.physics
        this.time = _options.time
        this.objects = _options.objects
        this.world = _options.world

        // Setup
        this.raycaster = new THREE.Raycaster()
        this.mouse = new THREE.Vector2(0, 0)
        this.selectedObject = null
        this.selectedBody = null
        this.constraint = null
        this.constraintBody = null

        // Mouse picking
        this.pickDistance = 10
        this.maxPickDistance = 30
        
        console.log('✓ Picker initialized')

        this.setListeners()
        this.setUpdate()
    }

    setListeners()
    {
        // Mouse move - track mouse position
        document.addEventListener('mousemove', (event) =>
        {
            this.mouse.x = (event.clientX / this.sizes.viewport.width) * 2 - 1
            this.mouse.y = -(event.clientY / this.sizes.viewport.height) * 2 + 1
            
            // Visual feedback when hovering over pickable objects
            if(!this.selectedBody)
            {
                const pickableObject = this.getPickableObjectAtMouse()
                if(pickableObject)
                {
                    document.body.style.cursor = 'grab'
                }
                else
                {
                    document.body.style.cursor = 'auto'
                }
            }
        })

        // Mouse down - left click for buttons, right click for picking
        document.addEventListener('mousedown', (event) =>
        {
            if(event.button === 0)
            {
                // Left click - check for menu/button interactions only
                this.checkButtonInteraction()
            }
            else if(event.button === 2)
            {
                // Right click - pick up objects
                this.pickObject()
            }
        })
        
        // Prevent context menu on right click
        document.addEventListener('contextmenu', (event) =>
        {
            event.preventDefault()
        })

        // Mouse up (release object) - right button only
        document.addEventListener('mouseup', (event) =>
        {
            if(event.button === 2)
            {
                this.releaseObject()
            }
        })
    }

    getPickableObjectAtMouse()
    {
        this.raycaster.setFromCamera(this.mouse, this.camera.instance)
        
        // Collect all pickable meshes
        const pickableMeshes = []
        for(const item of this.objects.items)
        {
            if(item.collision && item.collision.body && item.collision.body.mass > 0)
            {
                item.container.traverse((_child) =>
                {
                    if(_child instanceof THREE.Mesh)
                    {
                        pickableMeshes.push(_child)
                    }
                })
            }
        }
        
        // Raycast to find intersections
        const intersects = this.raycaster.intersectObjects(pickableMeshes, true)
        
        if(intersects.length > 0 && intersects[0].distance < this.maxPickDistance)
        {
            // Find which object this mesh belongs to
            const hitMesh = intersects[0].object
            for(const item of this.objects.items)
            {
                let found = false
                item.container.traverse((_child) =>
                {
                    if(_child === hitMesh)
                    {
                        found = true
                    }
                })
                
                if(found && item.collision && item.collision.body && item.collision.body.mass > 0)
                {
                    return { item, intersection: intersects[0] }
                }
            }
        }
        
        return null
    }

    checkButtonInteraction()
    {
        // Check for menu billboard interaction
        if(this.world && this.world.menuBillboard && this.world.menuBillboard.mesh)
        {
            this.raycaster.setFromCamera(this.mouse, this.camera.instance)
            const menuIntersects = this.raycaster.intersectObject(this.world.menuBillboard.mesh)
            
            if(menuIntersects.length > 0)
            {
                console.log('✓ Menu billboard clicked')
                const intersection = menuIntersects[0]
                if(intersection.uv)
                {
                    console.log('[Picker] Menu billboard UV:', intersection.uv)
                    // Handle menu click with UV coordinates
                    const handled = this.world.handleMenuClick(intersection.uv)
                    console.log('[Picker] Menu click handled:', handled)
                    if(handled)
                    {
                        return true // Menu click was handled
                    }
                }
            }
        }
        
        // Check for page panel clicks
        if(this.world && this.world.demoRoom && this.world.demoRoom.panels)
        {
            this.raycaster.setFromCamera(this.mouse, this.camera.instance)
            const pageMeshes = this.world.demoRoom.panels.map(p => p.mesh)
            const pageIntersects = this.raycaster.intersectObjects(pageMeshes)
            
            if(pageIntersects.length > 0)
            {
                const clickedMesh = pageIntersects[0].object
                const panel = this.world.demoRoom.panels.find(p => p.mesh === clickedMesh)
                if(panel && panel.pageIndex !== undefined)
                {
                    console.log('[Picker] Page clicked:', panel.pageIndex)
                    if(this.world.scrollNavigator)
                    {
                        if(this.world.scrollNavigator.isFocusingPage && this.world.scrollNavigator.focusedPageIndex === panel.pageIndex)
                        {
                            // Already focused, unfocus
                            this.world.scrollNavigator.unfocusPage()
                        }
                        else
                        {
                            // Focus on this page
                            this.world.scrollNavigator.focusOnPage(panel.pageIndex)
                        }
                    }
                    return true
                }
            }
        }

        // Check for portal interaction in lobby
        if(this.camera.currentRoom === 'lobby' && this.world && this.world.lobby)
        {
            const portalMeshes = []
            this.world.lobby.traverse((_child) =>
            {
                if(_child.userData && _child.userData.isPortal)
                {
                    portalMeshes.push(_child)
                }
            })

            if(portalMeshes.length > 0)
            {
                this.raycaster.setFromCamera(this.mouse, this.camera.instance)
                const portalIntersects = this.raycaster.intersectObjects(portalMeshes)
                
                if(portalIntersects.length > 0)
                {
                    const portal = portalIntersects[0].object
                    const room = portal.userData.room
                    console.log('✓ Portal clicked - teleporting to:', room)
                    
                    if(this.world.teleportToRoom)
                    {
                        this.world.teleportToRoom(room)
                    }
                    return true
                }
            }
        }
        
        return false
    }

    pickObject()
    {
        console.log('🖱️ Pick attempt - total objects:', this.objects.items.length)
        
        // Don't pick if already holding something
        if(this.selectedBody)
        {
            return
        }

        // Get pickable object at mouse position
        const pickable = this.getPickableObjectAtMouse()
        
        if(!pickable)
        {
            console.log('❌ No pickable object found at mouse position')
            return
        }
        
        console.log('✓ Found pickable object with mass:', pickable.item.collision.body.mass)

        try {
            // Store selected object and body
            this.selectedObject = pickable.item
            this.selectedBody = pickable.item.collision.body
            this.pickDistance = pickable.intersection.distance
            
            // Wake up the body if sleeping
            if(this.selectedBody.sleeping)
            {
                this.selectedBody.wakeUp()
            }
            
            // Store original body properties
            this.selectedBody.originalAngularDamping = this.selectedBody.angularDamping
            this.selectedBody.originalLinearDamping = this.selectedBody.linearDamping
            
            // Increase damping for smoother picking
            this.selectedBody.angularDamping = 0.9
            this.selectedBody.linearDamping = 0.5
            
            // Create a static body to attach the constraint to
            this.constraintBody = new CANNON.Body({ mass: 0 })
            this.constraintBody.position.set(
                pickable.intersection.point.x,
                pickable.intersection.point.y,
                pickable.intersection.point.z
            )
            this.constraintBody.collisionResponse = false
            this.physics.world.addBody(this.constraintBody)
            
            // Calculate local offset on the picked body
            const worldPoint = new CANNON.Vec3(
                pickable.intersection.point.x,
                pickable.intersection.point.y,
                pickable.intersection.point.z
            )
            const localPivot = new CANNON.Vec3()
            this.selectedBody.pointToLocalFrame(worldPoint, localPivot)
            
            // Create point-to-point constraint
            this.constraint = new CANNON.PointToPointConstraint(
                this.selectedBody,
                localPivot,
                this.constraintBody,
                new CANNON.Vec3(0, 0, 0),
                this.maxPickDistance * 100
            )
            
            this.physics.world.addConstraint(this.constraint)
            
            // Visual feedback
            document.body.style.cursor = 'grabbing'
            
            console.log('✓ Object picked successfully!')
        } catch(e) {
            console.error('❌ Error picking object:', e)
            this.releaseObject()
        }
    }

    releaseObject()
    {
        if(this.constraint)
        {
            this.physics.world.removeConstraint(this.constraint)
            this.constraint = null
        }
        
        if(this.constraintBody)
        {
            this.physics.world.removeBody(this.constraintBody)
            this.constraintBody = null
        }
        
        if(this.selectedBody)
        {
            // Restore original damping
            if(this.selectedBody.originalAngularDamping !== undefined)
            {
                this.selectedBody.angularDamping = this.selectedBody.originalAngularDamping
                this.selectedBody.linearDamping = this.selectedBody.originalLinearDamping
            }
            else
            {
                this.selectedBody.angularDamping = 0.01
                this.selectedBody.linearDamping = 0.01
            }
            
            this.selectedBody = null
            this.selectedObject = null
            console.log('✓ Object released')
        }
        
        // Reset cursor
        document.body.style.cursor = 'auto'
    }

    setUpdate()
    {
        this.time.on('tick', () =>
        {
            if(this.selectedBody && this.constraint && this.constraintBody)
            {
                // Update raycaster
                this.raycaster.setFromCamera(this.mouse, this.camera.instance)

                // Calculate target position in world space
                const distance = Math.min(this.pickDistance, 15)
                const targetPos = new THREE.Vector3()
                targetPos.copy(this.raycaster.ray.origin)
                targetPos.addScaledVector(this.raycaster.ray.direction, distance)

                // Move the constraint body to follow the mouse
                this.constraintBody.position.set(
                    targetPos.x,
                    targetPos.y,
                    targetPos.z
                )
                
                // Apply force to reduce jitter
                const velocity = this.selectedBody.velocity
                if(velocity.length() > 10)
                {
                    velocity.scale(0.95, velocity)
                }
            }
        })
    }
}
