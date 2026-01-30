import * as THREE from 'three'
import * as CANNON from 'cannon'
import Door from './Door.js'

export default class BrickWalls
{
    constructor(_options)
    {
        // Options
        this.resources = _options.resources
        this.camera = _options.camera
        this.physics = _options.physics

        // Set up
        this.container = new THREE.Object3D()
        this.container.matrixAutoUpdate = false

        this.walls = []
        this.doors = []
        this.brickModel = null

        // Load brick model once
        if(this.resources.items.brickBase)
        {
            this.brickModel = this.resources.items.brickBase.scene
        }
    }

    setWallsAroundRoom(_options)
    {
        // Options
        const centerX = _options.centerX || 0
        const centerY = _options.centerY || 0
        const width = _options.width || 20
        const height = _options.height || 20
        const wallHeight = _options.wallHeight || 3
        const doorSide = _options.doorSide || 'north'
        const nextRoom = _options.nextRoom

        // Scale for wall bricks (much larger than individual bricks)
        const brickScaleX = 2.5  // Wall brick width
        const brickScaleY = 2.5  // Wall brick height  
        const brickScaleZ = 0.8  // Wall brick depth

        // Create wall group
        const wallGroup = {
            bricks: [],
            container: new THREE.Object3D(),
            doors: []
        }

        // Four walls: North, South, East, West
        const walls = [
            {
                name: 'north',
                startX: centerX - width / 2,
                startY: centerY + height / 2,
                endX: centerX + width / 2,
                endY: centerY + height / 2,
                isHorizontal: true,
                length: width
            },
            {
                name: 'south',
                startX: centerX - width / 2,
                startY: centerY - height / 2,
                endX: centerX + width / 2,
                endY: centerY - height / 2,
                isHorizontal: true,
                length: width
            },
            {
                name: 'east',
                startX: centerX + width / 2,
                startY: centerY - height / 2,
                endX: centerX + width / 2,
                endY: centerY + height / 2,
                isHorizontal: false,
                length: height
            },
            {
                name: 'west',
                startX: centerX - width / 2,
                startY: centerY - height / 2,
                endX: centerX - width / 2,
                endY: centerY + height / 2,
                isHorizontal: false,
                length: height
            }
        ]

        for(const wall of walls)
        {
            const bricksPerRow = Math.ceil(wall.length / brickScaleX)
            // Make walls solid and taller - 4 rows (4x height)
            const bricksPerColumn = 4

            for(let row = 0; row < bricksPerColumn; row++)
            {
                const actualBricksPerRow = bricksPerRow

                for(let col = 0; col < actualBricksPerRow; col++)
                {
                    const position = new THREE.Vector3()

                    if(wall.isHorizontal)
                    {
                        position.x = wall.startX + col * brickScaleX
                        position.y = wall.startY
                    }
                    else
                    {
                        position.x = wall.startX
                        position.y = wall.startY + col * brickScaleX
                    }

                    // Stack bricks vertically with no gaps
                    position.z = row * brickScaleY

                    // Check if this brick should be removed for the door
                    const isDoorLocation = wall.name === doorSide
                    const doorCenterX = wall.isHorizontal ? (wall.startX + wall.endX) / 2 : wall.startX
                    const doorCenterY = wall.isHorizontal ? wall.startY : (wall.startY + wall.endY) / 2
                    
                    let isDoorBrick = false
                    if(isDoorLocation && row < 1)
                    {
                        const distX = Math.abs(position.x - doorCenterX)
                        const distY = Math.abs(position.y - doorCenterY)
                        isDoorBrick = distX < brickScaleX * 1.5 && distY < brickScaleX * 1.5
                    }

                    if(!isDoorBrick)
                    {
                        // Scale differs per wall direction
                        let scale = new THREE.Vector3(brickScaleX, brickScaleY, brickScaleZ)
                        
                        // For front/back walls (north/south): increase X (width)
                        if(wall.name === 'north' || wall.name === 'south')
                        {
                            scale.x = brickScaleX * 1.5
                        }
                        // For side walls (east/west): increase Z (depth)
                        else
                        {
                            scale.z = brickScaleZ * 1.5
                        }
                        
                        // North and South walls: rotate around X-axis and Z-axis; East and West: rotate around Y-axis
                        const rotation = (wall.name === 'north' || wall.name === 'south') 
                            ? new THREE.Euler(Math.PI * 0.5, 0, Math.PI * 0.5)
                            : new THREE.Euler(0, Math.PI * 0.5, 0)
                        this.addBrick(position, rotation, scale, wallGroup.bricks)
                    }
                }
            }

            // Add door on specified side
            if(wall.name === doorSide)
            {
                const doorCenterX = wall.isHorizontal ? (wall.startX + wall.endX) / 2 : wall.startX
                const doorCenterY = wall.isHorizontal ? wall.startY : (wall.startY + wall.endY) / 2
                let doorRotation = new THREE.Euler(0, 0, 0)

                if(wall.name === 'east')
                {
                    doorRotation.z = Math.PI * 0.5
                }
                else if(wall.name === 'west')
                {
                    doorRotation.z = Math.PI * 0.5
                }

                const door = new Door({
                    resources: this.resources,
                    position: new THREE.Vector3(doorCenterX, doorCenterY, 1),
                    rotation: doorRotation,
                    width: brickScaleX * 2.2,
                    height: wallHeight * 0.7,
                    targetRoom: nextRoom,
                    camera: this.camera
                })

                wallGroup.container.add(door.container)
                wallGroup.doors.push(door)
                this.doors.push(door)
            }
        }

        this.container.add(wallGroup.container)
        this.walls.push(wallGroup)

        return wallGroup
    }

    addBrick(_position, _rotation, _scale, _brickArray)
    {
        // If no brick model loaded, skip
        if(!this.brickModel)
        {
            return null
        }

        // Clone the brick model
        const brick = this.brickModel.clone()

        // Apply transformations
        brick.position.copy(_position)
        brick.rotation.copy(_rotation)
        brick.scale.copy(_scale)
        brick.matrixAutoUpdate = false
        brick.updateMatrix()

        // Ensure all meshes in the brick have shadows
        brick.traverse((_child) =>
        {
            if(_child instanceof THREE.Mesh)
            {
                _child.castShadow = true
                _child.receiveShadow = true
                _child.matrixAutoUpdate = false
            }
        })

        // Add physics body for collision
        if(this.physics)
        {
            const brickShape = new CANNON.Box(
                new CANNON.Vec3(_scale.x / 2, _scale.y / 2, _scale.z / 2)
            )
            const brickBody = new CANNON.Body({
                mass: 0, // Static body - doesn't move
                shape: brickShape
            })

            // Set position and rotation
            brickBody.position.set(_position.x, _position.y, _position.z)
            const quaternion = new THREE.Quaternion()
            quaternion.setFromEuler(_rotation)
            brickBody.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w)

            this.physics.world.addBody(brickBody)
        }

        this.container.add(brick)
        _brickArray.push(brick)

        return brick
    }

    checkDoorCollisions(_carPosition)
    {
        for(const door of this.doors)
        {
            if(door.checkCarCollision(_carPosition))
            {
                door.triggerTransition()
            }
            else
            {
                door.resetTrigger()
            }
        }
    }
}
