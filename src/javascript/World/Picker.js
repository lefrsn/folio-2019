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
        this.mouse = new THREE.Vector2()
        this.selectedObject = null
        this.selectedBody = null
        this.constraint = null

        // Mouse picking offset
        this.pickOffset = new THREE.Vector3()
        this.pickDistance = 0

        // Interaction distance
        this.maxPickDistance = 50
        
        // Constraint settings for smooth movement
        this.constraintStiffness = 1000 // Higher = stiffer, faster response
        this.constraintDamping = 50

        this.setListeners()
        this.setUpdate()
    }

    setListeners()
    {
        // Mouse move
        document.addEventListener('mousemove', (event) =>
        {
            this.mouse.x = (event.clientX / this.sizes.viewport.width) * 2 - 1
            this.mouse.y = -(event.clientY / this.sizes.viewport.height) * 2 + 1
            
            // Check if hovering over pickable object
            if(!this.selectedBody)
            {
                this.raycaster.setFromCamera(this.mouse, this.camera.instance)
                
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
                
                const intersects = this.raycaster.intersectObjects(pickableMeshes, true)
                
                if(intersects.length > 0)
                {
                    document.body.style.cursor = 'grab'
                }
                else
                {
                    document.body.style.cursor = 'auto'
                }
            }
        })

        // Mouse down (pick object) - left click only (button 0)
        document.addEventListener('mousedown', (event) =>
        {
            if(event.button === 0)
            {
                this.pickObject()
            }
        })

        // Mouse up (release object)
        document.addEventListener('mouseup', () =>
        {
            this.releaseObject()
        })
    }

    pickObject()
    {
        // Update raycaster with camera and mouse position
        this.raycaster.setFromCamera(this.mouse, this.camera.instance)

        // First check for portal interaction in lobby
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
                const intersects = this.raycaster.intersectObjects(portalMeshes)
                if(intersects.length > 0)
                {
                    const portal = intersects[0].object
                    if(portal.userData.portalName)
                    {
                        // Enter room
                        this.world.enterRoom(portal.userData.portalName)
                        return
                    }
                }
            }
        }

        // Get all meshes from objects
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

        // Check intersections
        const intersects = this.raycaster.intersectObjects(pickableMeshes, true)

        if(intersects.length > 0)
        {
            // Get the first hit object
            const hitMesh = intersects[0].object
            
            // Find the corresponding object and body
            for(const item of this.objects.items)
            {
                if(item.container.children.length > 0)
                {
                    let found = false
                    item.container.traverse((_child) =>
                    {
                        if(_child === hitMesh)
                        {
                            found = true
                        }
                    })

                    if(found)
                    {
                        this.selectedObject = item
                        this.selectedBody = item.collision.body
                        this.pickDistance = intersects[0].distance
                        
                        // Calculate pick offset
                        this.pickOffset.copy(intersects[0].point)
                        this.pickOffset.sub(new THREE.Vector3(this.selectedBody.position.x, this.selectedBody.position.y, this.selectedBody.position.z))

                        // Wake up the body
                        if(this.selectedBody.sleeping)
                        {
                            this.selectedBody.wakeUp()
                        }

                        // Create point to point constraint with improved stiffness
                        const pickPoint = new CANNON.Vec3(
                            this.pickOffset.x,
                            this.pickOffset.y,
                            this.pickOffset.z
                        )

                        this.constraint = new CANNON.PointToPointConstraint(
                            this.selectedBody,
                            pickPoint,
                            new CANNON.Body({ mass: 0 }),
                            new CANNON.Vec3(0, 0, 0)
                        )
                        
                        // Set constraint stiffness and damping for smooth movement
                        this.constraint.collideConnected = true
                        this.constraint.maxForce = 1000
                        
                        // Store the static body for constraint
                        this.constraintStaticBody = new CANNON.Body({ mass: 0 })
                        this.constraintStaticBody.position.set(0, 0, 0)

                        this.physics.world.addConstraint(this.constraint)
                        
                        // Lock rotation to keep object's original orientation
                        this.selectedBody.angularLock = true
                        
                        // Change cursor to grab/grabbing hand
                        document.body.style.cursor = 'grabbing'

                        break
                    }
                }
            }
        }
    }

    releaseObject()
    {
        if(this.selectedBody && this.constraint)
        {
            this.physics.world.removeConstraint(this.constraint)
            this.constraint = null
        }

        if(this.selectedBody)
        {
            // Unlock rotation when released
            this.selectedBody.angularLock = false
        }

        this.selectedObject = null
        this.selectedBody = null
        
        // Change cursor back to default
        document.body.style.cursor = 'auto'
    }

    setUpdate()
    {
        this.time.on('tick', () =>
        {
            if(this.selectedBody && this.constraint)
            {
                // Update the target position based on mouse position
                const raycaster = new THREE.Raycaster()
                raycaster.setFromCamera(this.mouse, this.camera.instance)

                // Calculate the world position where we want to move the object
                // Use a closer pick distance for snappier response
                const targetDistance = Math.min(this.pickDistance, 20)
                const direction = raycaster.ray.direction
                const newTargetPos = raycaster.ray.origin.clone()
                newTargetPos.addScaledVector(direction, targetDistance)

                // Update constraint target with smooth following
                this.constraint.pivotB.set(
                    newTargetPos.x,
                    newTargetPos.y,
                    newTargetPos.z
                )
                
                // Increase velocity damping for smoother movement
                this.selectedBody.linearDamping = 0.3
                this.selectedBody.angularDamping = 0.3
            }
        })
    }
}
