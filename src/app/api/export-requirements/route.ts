import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/session'
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType } from 'docx'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const { projectId, format = 'markdown', filters } = await request.json()

    // Build query
    const where: any = {
      project: {
        userId: user.id
      }
    }

    if (projectId) {
      where.projectId = projectId
    }

    if (filters) {
      if (filters.type && filters.type !== 'ALL') {
        where.type = filters.type
      }
      if (filters.priority && filters.priority !== 'ALL') {
        where.priority = filters.priority
      }
      if (filters.source && filters.source !== 'ALL') {
        where.source = filters.source
      }
    }

    // Fetch requirements
    const requirements = await prisma.requirement.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        document: {
          select: {
            id: true,
            originalName: true
          }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { type: 'asc' },
        { createdAt: 'desc' }
      ]
    })

    if (requirements.length === 0) {
      return NextResponse.json(
        { error: 'No requirements found to export' },
        { status: 400 }
      )
    }

    const projectName = requirements[0]?.project?.name || 'Requirements'
    const projectDescription = requirements[0]?.project?.description

    // Generate export content based on format
    if (format === 'markdown') {
      const content = generateMarkdownExport(requirements, projectName, projectDescription)
      return NextResponse.json({
        success: true,
        content,
        filename: `${projectName.replace(/\s+/g, '_')}_Requirements_${new Date().toISOString().split('T')[0]}.md`,
        mimeType: 'text/markdown',
        count: requirements.length
      })
    } else if (format === 'word') {
      const buffer = await generateWordExport(requirements, projectName, projectDescription)
      return new NextResponse(Buffer.from(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${projectName.replace(/\s+/g, '_')}_Requirements_${new Date().toISOString().split('T')[0]}.docx"`
        }
      })
    } else if (format === 'json') {
      const content = JSON.stringify(requirements, null, 2)
      return NextResponse.json({
        success: true,
        content,
        filename: `${projectName.replace(/\s+/g, '_')}_Requirements_${new Date().toISOString().split('T')[0]}.json`,
        mimeType: 'application/json',
        count: requirements.length
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid format. Supported formats: markdown, word, json' },
        { status: 400 }
      )
    }

  } catch (error: any) {
    console.error('Error exporting requirements:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to export requirements' },
      { status: 500 }
    )
  }
}

function generateMarkdownExport(requirements: any[], projectName: string, projectDescription?: string | null): string {
  let md = `# Requirements Document\n\n`
  md += `**Project:** ${projectName}\n`
  if (projectDescription) {
    md += `**Description:** ${projectDescription}\n`
  }
  md += `**Generated:** ${new Date().toLocaleString()}\n`
  md += `**Total Requirements:** ${requirements.length}\n\n`
  md += `---\n\n`

  // Group by type
  const byType = requirements.reduce((acc, req) => {
    if (!acc[req.type]) acc[req.type] = []
    acc[req.type].push(req)
    return acc
  }, {} as Record<string, any[]>)

  // Add table of contents
  md += `## Table of Contents\n\n`
  Object.keys(byType).forEach(type => {
    md += `- [${type.replace(/_/g, ' ')}](#${type.toLowerCase().replace(/_/g, '-')}) (${byType[type].length})\n`
  })
  md += `\n---\n\n`

  // Add requirements by type
  Object.entries(byType).forEach(([type, reqs]) => {
    md += `## ${type.replace(/_/g, ' ')}\n\n`
    
    const reqsArray = reqs as any[]
    reqsArray.forEach((req: any, idx: number) => {
      md += `### ${idx + 1}. ${req.title}\n\n`
      md += `**Priority:** ${req.priority}  \n`
      md += `**Source:** ${req.source.replace(/_/g, ' ')}  \n`
      if (req.confidence) {
        md += `**Confidence:** ${Math.round(req.confidence * 100)}%  \n`
      }
      if (req.document?.originalName) {
        md += `**Document:** ${req.document.originalName}  \n`
      }
      md += `**Created:** ${new Date(req.createdAt).toLocaleDateString()}  \n\n`
      md += `**Description:**\n\n${req.description}\n\n`
      
      if (req.sourceText) {
        md += `**Source Text:**\n\n> ${req.sourceText}\n\n`
      }
      
      if (req.rationale) {
        md += `**Rationale:**\n\n${req.rationale}\n\n`
      }
      
      md += `---\n\n`
    })
  })

  return md
}

async function generateWordExport(requirements: any[], projectName: string, projectDescription?: string | null): Promise<Buffer> {
  const { Packer } = await import('docx')
  
  const children: any[] = []

  // Title
  children.push(
    new Paragraph({
      text: 'Requirements Document',
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    })
  )

  // Project info
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Project: ', bold: true }),
        new TextRun(projectName)
      ],
      spacing: { after: 100 }
    })
  )

  if (projectDescription) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Description: ', bold: true }),
          new TextRun(projectDescription)
        ],
        spacing: { after: 100 }
      })
    )
  }

  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Generated: ', bold: true }),
        new TextRun(new Date().toLocaleString())
      ],
      spacing: { after: 100 }
    })
  )

  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Total Requirements: ', bold: true }),
        new TextRun(requirements.length.toString())
      ],
      spacing: { after: 400 }
    })
  )

  // Group by type
  const byType = requirements.reduce((acc, req) => {
    if (!acc[req.type]) acc[req.type] = []
    acc[req.type].push(req)
    return acc
  }, {} as Record<string, any[]>)

  // Add requirements by type
  Object.entries(byType).forEach(([type, reqs]) => {
    children.push(
      new Paragraph({
        text: type.replace(/_/g, ' '),
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 }
      })
    )

    const reqsArray = reqs as any[]
    reqsArray.forEach((req: any, idx: number) => {
      // Requirement title
      children.push(
        new Paragraph({
          text: `${idx + 1}. ${req.title}`,
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 300, after: 150 }
        })
      )

      // Metadata table
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'Priority', bold: true })] })],
                  width: { size: 30, type: WidthType.PERCENTAGE }
                }),
                new TableCell({
                  children: [new Paragraph(req.priority)],
                  width: { size: 70, type: WidthType.PERCENTAGE }
                })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'Source', bold: true })] })]
                }),
                new TableCell({
                  children: [new Paragraph(req.source.replace(/_/g, ' '))]
                })
              ]
            }),
            ...(req.confidence ? [new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'Confidence', bold: true })] })]
                }),
                new TableCell({
                  children: [new Paragraph(`${Math.round(req.confidence * 100)}%`)]
                })
              ]
            })] : []),
            ...(req.document?.originalName ? [new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'Document', bold: true })] })]
                }),
                new TableCell({
                  children: [new Paragraph(req.document.originalName)]
                })
              ]
            })] : []),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'Created', bold: true })] })]
                }),
                new TableCell({
                  children: [new Paragraph(new Date(req.createdAt).toLocaleDateString())]
                })
              ]
            })
          ],
          margins: {
            top: 100,
            bottom: 100,
            left: 100,
            right: 100
          }
        })
      )

      // Description
      children.push(
        new Paragraph({
          children: [new TextRun({ text: 'Description:', bold: true })],
          spacing: { before: 200, after: 100 }
        })
      )

      children.push(
        new Paragraph({
          text: req.description,
          spacing: { after: 200 }
        })
      )

      // Source text if available
      if (req.sourceText) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: 'Source Text:', bold: true })],
            spacing: { before: 100, after: 100 }
          })
        )
        
        children.push(
          new Paragraph({
            text: req.sourceText,
            indent: { left: 720 },
            spacing: { after: 200 }
          })
        )
      }

      // Rationale if available
      if (req.rationale) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: 'Rationale:', bold: true })],
            spacing: { before: 100, after: 100 }
          })
        )
        
        children.push(
          new Paragraph({
            text: req.rationale,
            spacing: { after: 300 }
          })
        )
      }
    })
  })

  const doc = new Document({
    sections: [
      {
        properties: {},
        children
      }
    ]
  })

  const buffer = await Packer.toBuffer(doc)
  return Buffer.from(buffer)
}

function generateCSVExport(requirements: any[]): string {
  const headers = ['ID', 'Title', 'Description', 'Type', 'Priority', 'Source', 'Confidence', 'Document', 'Created', 'Updated']
  const rows = requirements.map(req => [
    req.id,
    `"${req.title.replace(/"/g, '""')}"`,
    `"${req.description.replace(/"/g, '""')}"`,
    req.type,
    req.priority,
    req.source,
    req.confidence ? Math.round(req.confidence * 100) : '',
    req.document?.originalName ? `"${req.document.originalName}"` : '',
    new Date(req.createdAt).toLocaleDateString(),
    req.updatedAt ? new Date(req.updatedAt).toLocaleDateString() : ''
  ])

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
}
